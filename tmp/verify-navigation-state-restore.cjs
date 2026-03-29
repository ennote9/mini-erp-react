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

async function bootstrapPage(page, locale = "en") {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: buildSettingsPayload(locale) },
  );
}

async function waitForGrid(page) {
  await page.waitForSelector(".ag-root-wrapper, .ag-root");
}

async function getGridViewport(page) {
  return page.locator(".ag-body-viewport").first();
}

async function clickFirstGridRow(page) {
  await page.locator(".ag-center-cols-container .ag-row").first().click();
}

async function clickBreadcrumbBack(page) {
  await page.locator(".doc-page__breadcrumb button").first().click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const result = {};

  try {
    await bootstrapPage(page, "en");

    // Items list -> item -> back with tab + scroll restore
    await page.goto(`${APP_ROOT}/items?q=ITEM`, { waitUntil: "networkidle" });
    await waitForGrid(page);
    const itemsViewport = await getGridViewport(page);
    await itemsViewport.evaluate((el) => {
      el.scrollTop = 320;
    });
    await page.waitForTimeout(150);
    result.itemsScrollBefore = await itemsViewport.evaluate((el) => el.scrollTop);
    await clickFirstGridRow(page);
    await page.waitForURL(/\/items\/\d+\?returnTo=/);
    result.itemDetailUrl = page.url();
    await page.getByRole("tab", { name: "Barcodes" }).click();
    await page.waitForTimeout(100);
    result.itemDetailTabUrl = page.url();
    await page.reload({ waitUntil: "networkidle" });
    result.itemDetailTabUrlAfterReload = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/items\?q=ITEM/);
    await waitForGrid(page);
    const itemsViewportAfter = await getGridViewport(page);
    await page.waitForTimeout(250);
    result.itemsReturnUrl = page.url();
    result.itemsScrollAfter = await itemsViewportAfter.evaluate((el) => el.scrollTop);

    // Barcode registry -> item -> back
    await page.goto(`${APP_ROOT}/barcodes?q=590&type=ITEM_BARCODE`, { waitUntil: "networkidle" });
    await waitForGrid(page);
    result.barcodeRegistryUrlBefore = page.url();
    await clickFirstGridRow(page);
    await page.waitForURL(/\/items\/\d+\?returnTo=/);
    result.barcodeDrilldownUrl = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/barcodes\?/);
    result.barcodeRegistryUrlAfter = page.url();

    // Markdown register return context via create -> back
    await page.goto(`${APP_ROOT}/markdown-journal?view=codes&q=MD`, { waitUntil: "networkidle" });
    result.markdownRegisterUrlBefore = page.url();
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/markdown-journal\/new\?returnTo=/);
    result.markdownCreateUrl = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/markdown-journal\?view=codes&q=MD/);
    result.markdownRegisterUrlAfter = page.url();

    // Stock balances -> detail -> back
    await page.goto(`${APP_ROOT}/stock-balances?style=GOOD&q=ITEM`, { waitUntil: "networkidle" });
    await waitForGrid(page);
    result.stockBalancesUrlBefore = page.url();
    await clickFirstGridRow(page);
    await page.waitForURL(/\/stock-balances\/\d+\?returnTo=/);
    result.stockBalanceDetailUrl = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/stock-balances\?style=GOOD&q=ITEM/);
    result.stockBalancesUrlAfter = page.url();

    // Sales orders list -> document -> payments tab -> reload -> back
    await page.goto(`${APP_ROOT}/sales-orders?q=SO`, { waitUntil: "networkidle" });
    await waitForGrid(page);
    result.salesOrdersListUrlBefore = page.url();
    await clickFirstGridRow(page);
    await page.waitForURL(/\/sales-orders\/[^/]+\?returnTo=/);
    result.salesOrderDocumentUrl = page.url();
    await page.goto(`${page.url()}&tab=payments`, { waitUntil: "networkidle" });
    result.salesOrderPaymentsUrl = page.url();
    await page.reload({ waitUntil: "networkidle" });
    result.salesOrderPaymentsUrlAfterReload = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/sales-orders\?q=SO/);
    result.salesOrdersListUrlAfter = page.url();

    // Purchase orders list -> attachments tab -> reload -> back
    await page.goto(`${APP_ROOT}/purchase-orders?q=PO`, { waitUntil: "networkidle" });
    await waitForGrid(page);
    result.purchaseOrdersListUrlBefore = page.url();
    await clickFirstGridRow(page);
    await page.waitForURL(/\/purchase-orders\/[^/]+\?returnTo=/);
    result.purchaseOrderDocumentUrl = page.url();
    await page.goto(`${page.url()}&tab=attachments`, { waitUntil: "networkidle" });
    result.purchaseOrderAttachmentsUrl = page.url();
    await page.reload({ waitUntil: "networkidle" });
    result.purchaseOrderAttachmentsUrlAfterReload = page.url();
    await clickBreadcrumbBack(page);
    await page.waitForURL(/\/purchase-orders\?q=PO/);
    result.purchaseOrdersListUrlAfter = page.url();

    const outPath = path.join(process.cwd(), "tmp", "navigation-state-restore-verification.json");
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(outPath);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
