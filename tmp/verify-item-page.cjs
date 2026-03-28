const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const ITEM_URL = `${APP_ROOT}/items/1`;
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

async function bootstrapPage(page) {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: settingsPayload },
  );
}

async function collectMainState(page) {
  await page.goto(ITEM_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");

  const state = await page.evaluate(() => {
    const qText = (selector) => {
      const el = document.querySelector(selector);
      return el ? (el.textContent || "").trim() : null;
    };
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((el) => ({
      text: (el.textContent || "").trim(),
      selected: el.getAttribute("data-state") === "active",
    }));
    const labels = Array.from(document.querySelectorAll("label")).map((el) => (el.textContent || "").trim());
    const headerButtons = Array.from(document.querySelectorAll(".doc-header button")).map((el) =>
      (el.textContent || "").trim(),
    );
    const barcodeSummaryVisible = Array.from(document.querySelectorAll("p")).some((el) =>
      (el.textContent || "").trim() === "Barcode summary",
    );
    return {
      topBar: qText(".app-topbar__title"),
      header: qText(".doc-header__title"),
      tabs,
      labels,
      headerButtons,
      barcodeSummaryVisible,
    };
  });

  await page.screenshot({ path: path.join(process.cwd(), "tmp", "item-card-main.png"), fullPage: true });
  return state;
}

async function collectBarcodesState(page) {
  await page.getByRole("tab", { name: "Barcodes" }).click();
  await page.waitForTimeout(200);

  const beforeDialog = await page.evaluate(() => ({
    hasTable: !!document.querySelector("table"),
    createButtonVisible: Array.from(document.querySelectorAll("button")).some(
      (el) => (el.textContent || "").trim() === "Create barcode",
    ),
    inlineBarcodeEditorVisible: Array.from(document.querySelectorAll("label")).some(
      (el) => (el.textContent || "").trim() === "Barcode value",
    ),
    dialogVisible: !!document.querySelector("[role='dialog']"),
  }));

  await page.getByRole("button", { name: "Create barcode" }).click();
  await page.waitForSelector("[role='dialog']");

  const dialogState = await page.evaluate(() => ({
    createDialogTitle: Array.from(document.querySelectorAll("[role='dialog'] *")).find((el) =>
      (el.textContent || "").trim() === "Create barcode",
    )?.textContent?.trim() ?? null,
    barcodeValueLabelVisible: Array.from(document.querySelectorAll("[role='dialog'] label")).some(
      (el) => (el.textContent || "").trim() === "Barcode value",
    ),
  }));

  await page.screenshot({ path: path.join(process.cwd(), "tmp", "item-card-barcodes-dialog.png"), fullPage: true });
  await page.locator("[role='dialog']").getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(150);

  return { beforeDialog, dialogState };
}

async function collectTesterCreateState(page) {
  await page.getByRole("tab", { name: "Testers" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(process.cwd(), "tmp", "item-card-testers.png"), fullPage: true });

  await page.getByRole("button", { name: "Create tester" }).click();
  await page.waitForURL(/\/items\/new\?kind=TESTER&baseItemId=1/);
  await page.getByRole("heading", { name: "New tester" }).waitFor();
  await page.waitForTimeout(150);

  const labels = await page.locator("label").evaluateAll((nodes) =>
    nodes
      .map((node) => (node.textContent || "").trim())
      .filter((text) => text.length > 0),
  );
  const state = {
    url: page.url(),
    topBar: (await page.locator(".app-topbar__title").textContent())?.trim() ?? null,
    header: (await page.locator(".doc-header__title").textContent())?.trim() ?? null,
    labels,
  };

  await page.screenshot({ path: path.join(process.cwd(), "tmp", "item-card-tester-create.png"), fullPage: true });
  return state;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await bootstrapPage(page);

    const mainState = await collectMainState(page);
    const barcodesState = await collectBarcodesState(page);
    const testerCreateState = await collectTesterCreateState(page);

    const result = {
      mainState,
      barcodesState,
      testerCreateState,
    };

    const outPath = path.join(process.cwd(), "tmp", "item-page-verification.json");
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
