const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";

function buildSettingsPayload(locale = "en") {
  return JSON.stringify({
    version: 1,
    settings: {
      general: {
        workspaceMode: "advanced",
        profileOverrides: {
          documentEventLog: true,
          reverseDocumentActions: true,
          stockMovementsNav: true,
          advancedStockBalanceAnalytics: true,
          stockBalanceSourceModal: true,
          allocationControls: true,
        },
        locale,
        theme: "dark",
        dateFormat: "iso",
        numberFormat: "commaDot",
        hotkeysEnabled: true,
      },
      documents: {
        blockConfirmWhenPlanningHasBlockingErrors: true,
        blockPostWhenFactualHasBlockingErrors: true,
        showDocumentEventLog: true,
        requireCancelReason: true,
        requireReversalReason: true,
        autoClosePlanningOnFullFulfillment: true,
        singleDraftReceiptPerPurchaseOrder: true,
        singleDraftShipmentPerSalesOrder: true,
      },
      inventory: {
        reservationsEnabled: true,
        requireReservationBeforeShipment: true,
        allocationMode: "manual",
        releaseReservationsOnSalesOrderCancel: true,
        releaseReservationsOnSalesOrderClose: true,
        reconcileReservationsOnSalesOrderSaveConfirm: true,
      },
      commercial: {
        moneyDecimalPlaces: 2,
        zeroPriceLinesRequireReason: true,
        partnerTermsOverwrite: "document_wins",
      },
      dataAudit: {
        auditLogEnabled: true,
        showAppVersion: true,
      },
    },
  });
}

async function applySettings(page, locale = "en") {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: buildSettingsPayload(locale) },
  );
}

async function waitForSaveOutcome(page, initialUrl, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const currentUrl = page.url();
    const hasAlert = (await page.getByRole("alert").count()) > 0;
    if (currentUrl !== initialUrl || hasAlert) return;
    await page.waitForTimeout(150);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await applySettings(page, "en");

    const result = {};

    await page.goto(`${APP_ROOT}/items`, { waitUntil: "networkidle" });
    await page.waitForSelector(".ag-root-wrapper, .ag-root");

    result.listCreateButtonCount = await page.getByRole("button", { name: "Create" }).count();
    result.listTesterButtonCount = await page.getByRole("button", { name: "Tester" }).count();
    result.listCreateChooserVisible = await page.getByText("What are you creating?").count();

    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/items\/new$/);
    result.newItemUrl = page.url();
    result.newItemTopBar = ((await page.locator(".app-topbar__title").textContent()) || "").trim();
    result.newItemHeader = ((await page.locator(".doc-header__title").textContent()) || "").trim();
    result.newItemCreateChooserVisible = await page.getByText("What are you creating?").count();
    result.newItemTesterButtonCount = await page.getByRole("button", { name: "Tester" }).count();

    await page.goto(`${APP_ROOT}/items`, { waitUntil: "networkidle" });
    await page.locator('input[aria-label="Search items"]').fill("ITEM-001");
    await page.waitForTimeout(300);
    result.baseItemListRows = await page.locator(".ag-center-cols-container .ag-row").evaluateAll((rows) =>
      rows.map((row) => ({
        code: (row.querySelector('[col-id="code"]')?.textContent || "").trim(),
        kind: (row.querySelector('[col-id="itemKind"]')?.textContent || "").trim(),
      })),
    );

    await page.goto(`${APP_ROOT}/items/1`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Testers" }).click();
    await page.waitForTimeout(200);
    result.itemCardCreateTesterVisible = await page.getByRole("button", { name: "Create tester" }).count();
    await page.getByRole("button", { name: "Create tester" }).click();
    await page.waitForURL(/\/items\/new\?kind=TESTER&baseItemId=1/);
    result.testerCreateInitialUrl = page.url();
    result.testerCreateInitialHeader = ((await page.locator(".doc-header__title").textContent()) || "").trim();
    result.baseItemSectionVisible = await page.getByText("Linked base item (sellable)").count();
    result.prefilledTesterCode = await page.locator("#item-code").inputValue();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSaveOutcome(page, result.testerCreateInitialUrl);
    result.testerSaveUrlAfterClick = page.url();
    result.testerSaveAlertText = (await page.getByRole("alert").count())
      ? ((await page.getByRole("alert").textContent()) || "").trim()
      : null;
    result.testerSaveIssueStripText = (await page.locator(".doc-health-strip").count())
      ? ((await page.locator(".doc-health-strip").textContent()) || "").trim()
      : null;
    result.testerSaveHeaderAfterClick = (await page.locator(".doc-header__title").count())
      ? ((await page.locator(".doc-header__title").textContent()) || "").trim()
      : null;
    result.testerSaveTopBarAfterClick = (await page.locator(".app-topbar__title").count())
      ? ((await page.locator(".app-topbar__title").textContent()) || "").trim()
      : null;

    await page.goto(`${APP_ROOT}/items`, { waitUntil: "networkidle" });
    await page.locator('input[aria-label="Search items"]').fill(result.prefilledTesterCode);
    await page.waitForTimeout(500);
    result.createdTesterRows = await page.locator(".ag-center-cols-container .ag-row").evaluateAll((rows) =>
      rows.map((row) => ({
        code: (row.querySelector('[col-id="code"]')?.textContent || "").trim(),
        kind: (row.querySelector('[col-id="itemKind"]')?.textContent || "").trim(),
      })),
    );

    await page.locator(".ag-center-cols-container .ag-row").first().click();
    await page.waitForURL(/\/items\/\d+$/);
    result.createdTesterDetailUrl = page.url();
    result.createdTesterDetailHeader = (await page.locator(".doc-header__title").count())
      ? ((await page.locator(".doc-header__title").textContent()) || "").trim()
      : null;
    result.createdTesterBaseItemSectionTitle = await page.locator(".font-medium.text-foreground\\/90").evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent || "").trim()),
    );
    result.createdTesterOpenBaseItemVisible = await page.getByRole("link", { name: "Open base item" }).count();

    const ruContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: "dark",
    });
    await ruContext.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: SETTINGS_KEY, value: buildSettingsPayload("ru") },
    );
    const ruPage = await ruContext.newPage();
    await ruPage.goto(`${APP_ROOT}/items`, { waitUntil: "networkidle" });
    await ruPage.locator('input[aria-label="Поиск номенклатуры"]').fill("ITEM-001");
    await ruPage.waitForTimeout(300);
    result.baseItemListRowsRu = await ruPage.locator(".ag-center-cols-container .ag-row").evaluateAll((rows) =>
      rows.map((row) => ({
        code: (row.querySelector('[col-id="code"]')?.textContent || "").trim(),
        kind: (row.querySelector('[col-id="itemKind"]')?.textContent || "").trim(),
      })),
    );
    await ruContext.close();

    const outPath = path.join(process.cwd(), "tmp", "items-create-flow-verification.json");
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(outPath);
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
