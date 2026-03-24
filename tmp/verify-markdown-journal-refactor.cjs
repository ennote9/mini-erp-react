const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:4173";
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
      locale: "en",
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

async function seedSettings(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SETTINGS_KEY, value: JSON.stringify(SETTINGS) },
  );
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    topBar: document.querySelector(".app-topbar__title")?.textContent?.trim() ?? null,
    header: document.querySelector(".doc-header__title")?.textContent?.trim() ?? null,
    controlsText: document.querySelector(".list-page__controls")?.textContent?.trim() ?? null,
    hasGrid: !!document.querySelector(".ag-root-wrapper"),
    hasEmptyState: !!document.querySelector(".list-page__empty"),
    hasDialog: !!document.querySelector('[role="dialog"]'),
    hasSheet: !!document.querySelector('[data-side="right"]'),
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await seedSettings(page);

  const out = {};

  await page.goto(`${BASE}/sales-orders`, { waitUntil: "networkidle" });
  await page.waitForSelector(".list-page__controls");
  out.salesOrders = await snapshot(page);
  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-sales-orders.png"),
    fullPage: true,
  });

  await page.goto(`${BASE}/markdown-journal`, { waitUntil: "networkidle" });
  await page.waitForSelector(".list-page__controls");
  out.markdownJournal = await snapshot(page);
  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-markdown-journal.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /^Create$/ }).click();
  await page.waitForURL(`${BASE}/markdown-journal/new`);
  await page.waitForSelector(".doc-header__title");
  out.markdownCreate = await snapshot(page);
  out.markdownCreate.breadcrumb =
    (await page.locator(".doc-page__breadcrumb").textContent())?.trim() ?? null;
  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-markdown-create.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /^Cancel$/ }).click();
  await page.waitForURL(`${BASE}/markdown-journal`);
  await page.waitForSelector(".list-page__controls");
  await page.waitForTimeout(250);
  out.afterCancel = await snapshot(page);
  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-markdown-journal-after-cancel.png"),
    fullPage: true,
  });

  await fs.writeFile(
    path.join(process.cwd(), "tmp", "markdown-journal-refactor-verification.json"),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
