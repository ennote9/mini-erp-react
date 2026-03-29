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
    viewport: { width: 1480, height: 1200 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    await bootstrapPage(page, "en");
    await page.goto(`${APP_ROOT}/purchase-orders/1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".doc-header__title");

    const result = await page.evaluate(() => {
      const sectionHeads = Array.from(document.querySelectorAll("h3"))
        .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
        .filter((text) => ["Document", "Supply", "Commercial", "Notes"].includes(text));

      const fieldText = document.body.textContent || "";
      const topCard = document.querySelector(".doc-page [data-slot='card-content']")?.parentElement?.parentElement;
      const linesTabPanel = document.querySelector(".doc-po-working-area");
      const executionTabButton = Array.from(document.querySelectorAll('[role="tab"]')).find(
        (node) => (node.textContent || "").replace(/\s+/g, " ").trim() === "Execution",
      );

      return {
        url: window.location.href,
        sectionHeads,
        hasSupplierLabel: fieldText.includes("Supplier"),
        hasWarehouseLabel: fieldText.includes("Warehouse"),
        hasPaymentTermsLabel: fieldText.includes("Payment terms (days)"),
        hasCommentField: Boolean(document.querySelector("#po-comment")),
        commentTag: document.querySelector("#po-comment")?.tagName || null,
        topCardWidthClass:
          topCard?.className || null,
        lowerAreaHasExecutionTab: Boolean(executionTabButton),
        lowerAreaHasLinesGrid: Boolean(linesTabPanel?.querySelector(".ag-root-wrapper, .ag-root")),
        lowerAreaHasTotals: Boolean(linesTabPanel?.querySelector(".doc-lines__totals--sticky")),
      };
    });

    const outPath = path.join(process.cwd(), "tmp", "purchase-order-upper-block-verification.json");
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
