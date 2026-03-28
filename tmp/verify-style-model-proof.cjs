const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";
const SETTINGS = {
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
      locale: "ru",
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
};

async function seedSettings(context) {
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: JSON.stringify(SETTINGS) },
  );
}

async function readAgGridStyleCells(page) {
  await page.waitForTimeout(500);
  const rowCount = await page.locator(".ag-center-cols-container .ag-row").count();
  if (rowCount === 0) return [];
  return page
    .locator('.ag-center-cols-container .ag-row [col-id="style"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.textContent?.trim() ?? "")
        .filter(Boolean),
    );
}

async function openSelectAndPick(page, triggerSelector, optionLabel) {
  await page.locator(triggerSelector).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

async function spaNavigate(page, nextPath) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, nextPath);
}

async function waitUntilEnabled(locator, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(150);
  }
  throw new Error("Timed out waiting for control to become enabled.");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  await seedSettings(context);
  const page = await context.newPage();

  const result = {};

  await page.goto(`${BASE}/warehouses/1`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Настройки склада" }).click();
  result.warehouseStylePolicyLabel = (
    await page.locator('label[for="warehouse-style-policy"]').textContent()
  )?.trim();
  result.warehouseStylePolicyValue = (
    await page.locator("#warehouse-style-policy").textContent()
  )?.trim();

  await page.goto(`${BASE}/purchase-orders/1`, { waitUntil: "networkidle" });
  const confirmButton = page.getByRole("button", { name: "Подтвердить", exact: true });
  if (await confirmButton.count()) {
    await confirmButton.click();
    await page.waitForTimeout(500);
  }
  const createReceiptButton = page.getByRole("button", { name: "Создать поступление" });
  await waitUntilEnabled(createReceiptButton);
  result.createReceiptEnabled = await createReceiptButton.isEnabled();
  await createReceiptButton.click();
  await page.waitForURL(/\/receipts\/\d+/, { timeout: 10000 });
  result.receiptUrl = page.url();
  const postReceiptButton = page.getByRole("button", { name: "Провести", exact: true });
  await waitUntilEnabled(postReceiptButton);
  await postReceiptButton.click();
  await page.waitForTimeout(800);
  result.receiptPostError = (await page.getByRole("alert").count())
    ? ((await page.getByRole("alert").textContent()) || "").trim()
    : null;

  await spaNavigate(page, "/markdown-journal/new?itemId=1");
  await page.waitForSelector("#markdown-line-price");
  await page.locator("#markdown-line-price").fill("1");
  await page.getByRole("button", { name: "Добавить строку" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.waitForURL(/\/markdown-journal\/journals\/\d+/, { timeout: 10000 });
  result.journalUrlAfterSave = page.url();
  result.journalNumber = (await page.locator("#markdown-number").count())
    ? ((await page.locator("#markdown-number").textContent()) || "").trim()
    : ((await page.locator(".doc-header__title").textContent()) || "").trim();
  await page.getByRole("button", { name: "Провести" }).click();
  await page.waitForTimeout(1000);
  const postAlert = page.getByRole("alert");
  result.postError = (await postAlert.count())
    ? ((await postAlert.textContent()) || "").trim()
    : null;
  if (!result.postError) {
    await page.getByRole("button", { name: "Печать стикеров" }).waitFor({
      timeout: 10000,
    });
  }
  result.journalUrlAfterPost = page.url();
  result.codesTabVisible = await page.getByRole("tab", { name: "Коды уценки" }).count();

  await spaNavigate(page, "/stock-balances?itemId=1");
  await page.waitForSelector(".ag-root-wrapper");
  result.stockBalancesStyleHeaderVisible = await page.getByText("Стиль", { exact: true }).count();
  result.styleFilterVisible = await page.getByText("Все стили", { exact: true }).count();
  result.styleCellsBeforeFilter = await readAgGridStyleCells(page);

  await openSelectAndPick(page, '[aria-label="Фильтр по стилю остатка"]', "Уценка");
  await page.waitForTimeout(300);
  result.styleFilterSelected = (
    await page.locator('[aria-label="Фильтр по стилю остатка"]').textContent()
  )?.trim();
  result.styleCellsAfterFilter = await readAgGridStyleCells(page);

  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-style-model-proof.png"),
    fullPage: true,
  });

  await fs.writeFile(
    path.join(process.cwd(), "tmp", "style-model-proof.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
