const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";

function buildSettings(locale = "en") {
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
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SETTINGS_KEY, value: buildSettings(locale) },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    await bootstrapPage(page, "en");
    await page.goto(`${APP_ROOT}/purchase-orders/1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".doc-header__title");

    const linesTabName = "Lines";
    const executionTabName = "Execution";

    await page.getByRole("tab", { name: linesTabName }).click();
    await page.waitForTimeout(150);

    const linesState = await page.evaluate(() => ({
      url: window.location.href,
      hasInlineExecutionHeading: Boolean(
        Array.from(document.querySelectorAll("body *")).find(
          (node) => (node.textContent || "").trim() === "Receipt fulfillment",
        ),
      ),
      hasGrid: Boolean(document.querySelector(".doc-lines .ag-root-wrapper, .doc-lines .ag-root")),
      hasTotals: Boolean(document.querySelector(".doc-lines__totals--sticky")),
    }));

    await page.getByRole("tab", { name: executionTabName }).click();
    await page.waitForTimeout(150);

    const executionState = await page.evaluate(() => ({
      url: window.location.href,
      headingTexts: Array.from(document.querySelectorAll(".doc-po-tab-panel--execution [data-slot='card-title'], .doc-po-tab-panel--execution .text-sm"))
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean),
      hasReceiptFulfillment: Boolean(
        Array.from(document.querySelectorAll(".doc-po-tab-panel--execution *")).find(
          (node) => (node.textContent || "").trim() === "Receipt fulfillment",
        ),
      ),
      metricLabels: Array.from(document.querySelectorAll(".doc-po-tab-panel--execution p"))
        .map((node) => (node.textContent || "").trim())
        .filter((text) => ["Received", "Ordered", "Remaining"].includes(text)),
    }));

    await page.reload({ waitUntil: "networkidle" });
    const executionUrlAfterReload = page.url();

    const result = {
      linesState,
      executionState,
      executionUrlAfterReload,
    };

    const outPath = path.join(process.cwd(), "tmp", "purchase-order-execution-tab-verification.json");
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
