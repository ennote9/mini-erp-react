const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const PAGE_URL = `${APP_ROOT}/warehouses/1`;
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

async function activeLabels(page) {
  return page.locator('[role="tabpanel"][data-state="active"] label').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || "").trim()).filter((text) => text.length > 0),
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: SETTINGS_KEY, value: settingsPayload },
    );

    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".doc-header__title");

    const pageState = await page.evaluate(() => ({
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
        text: (el.textContent || "").trim(),
        selected: el.getAttribute("data-state") === "active",
      })),
    }));

    const mainLabels = await activeLabels(page);
    await page.screenshot({ path: path.join(process.cwd(), "tmp", "warehouse-card-main.png"), fullPage: true });

    await page.getByRole("tab", { name: "Address & contacts" }).click();
    await page.waitForTimeout(150);
    const addressLabels = await activeLabels(page);
    await page.screenshot({ path: path.join(process.cwd(), "tmp", "warehouse-card-address.png"), fullPage: true });

    await page.getByRole("tab", { name: "Warehouse settings" }).click();
    await page.waitForTimeout(150);
    const settingsLabels = await activeLabels(page);
    await page.screenshot({ path: path.join(process.cwd(), "tmp", "warehouse-card-settings.png"), fullPage: true });

    const result = { pageState, mainLabels, addressLabels, settingsLabels };
    const outPath = path.join(process.cwd(), "tmp", "warehouse-page-verification.json");
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
