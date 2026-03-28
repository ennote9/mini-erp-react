const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const PAGE_URL = `${APP_ROOT}/stock-balances`;
const SETTINGS_KEY = "mini-erp-app-settings-v1";

const settingsPayload = JSON.stringify({
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
});

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: SETTINGS_KEY, value: settingsPayload },
    );

    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".ag-root");

    const listState = await page.evaluate(() => ({
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      rowCount: document.querySelectorAll(".ag-center-cols-container .ag-row").length,
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
    }));

    await page.screenshot({
      path: path.join(process.cwd(), "tmp", "stock-balances-list-before-detail.png"),
      fullPage: true,
    });

    const firstItemCell = page.locator('.ag-center-cols-container .ag-row[row-index="0"] [col-id="itemCode"]').first();
    const clickedItemCode = ((await firstItemCell.textContent()) || "").trim();
    await firstItemCell.click();

    await page.waitForURL(/\/stock-balances\/[^/?#]+(?:\?.*)?$/);
    await page.waitForSelector(".doc-header__title");

    const detailState = await page.evaluate(() => ({
      url: window.location.href,
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
      backHref:
        document.querySelector('.doc-page__breadcrumb a[href^="/stock-balances"]')?.getAttribute("href") || "",
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
      summaryLabels: Array.from(document.querySelectorAll(".doc-page .rounded.border.border-border\\/60"))
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 4),
    }));

    await page.screenshot({
      path: path.join(process.cwd(), "tmp", "stock-balance-detail-page.png"),
      fullPage: true,
    });

    await page.locator('.doc-page__breadcrumb a[href^="/stock-balances"]').first().click();
    await page.waitForURL(/\/stock-balances(?:\?.*)?$/);
    await page.waitForSelector(".ag-root");

    const backState = await page.evaluate(() => ({
      url: window.location.href,
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
    }));

    const result = { listState, clickedItemCode, detailState, backState };
    const outPath = path.join(process.cwd(), "tmp", "stock-balances-detail-verification.json");
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
