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

async function fillDatePickerInput(page, selector, displayValue) {
  const input = page.locator(selector);
  await input.fill(displayValue);
  await input.blur();
}

async function verifyPurchaseOrder(page) {
  await page.goto(`${APP_ROOT}/purchase-orders/1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");

  const editState = await page.evaluate(() => ({
    url: window.location.href,
    hasPreliminaryField: Boolean(document.querySelector("#po-preliminary-delivery-date")),
    hasActualArrivalField: Boolean(document.querySelector("#po-actual-arrival-datetime")),
    actualArrivalInputType:
      document.querySelector("#po-actual-arrival-datetime")?.getAttribute("type") || null,
    sectionHeads: Array.from(document.querySelectorAll("h3"))
      .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
      .filter((value) => ["Document", "Supply", "Commercial", "Notes"].includes(value)),
  }));

  await fillDatePickerInput(page, "#po-preliminary-delivery-date", "05.04.2026");
  await page.locator("#po-actual-arrival-datetime").fill("2026-04-06T14:30");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(400);

  const readonlyState = await page.evaluate(() => {
    const text = document.body.textContent || "";
    return {
      url: window.location.href,
      hasPreliminaryLabel: text.includes("Preliminary delivery date"),
      hasActualArrivalLabel: text.includes("Actual arrival date and time"),
      hasPreliminaryValue: text.includes("2026-04-05"),
      hasActualArrivalValue: text.includes("2026-04-06 14:30"),
      hasEditableInputs: Boolean(document.querySelector("#po-preliminary-delivery-date")),
      tabs: Array.from(document.querySelectorAll('[role="tab"]'))
        .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    };
  });

  return { editState, readonlyState };
}

async function verifySalesOrder(page) {
  await page.goto(`${APP_ROOT}/sales-orders/1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");

  const editState = await page.evaluate(() => ({
    url: window.location.href,
    hasPreliminaryField: Boolean(document.querySelector("#so-preliminary-shipment-date")),
    hasActualShipmentField: Boolean(document.querySelector("#so-actual-shipment-date")),
    sectionHeads: Array.from(document.querySelectorAll("h3"))
      .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
      .filter((value) => ["Document", "Delivery", "Commercial", "Notes"].includes(value)),
  }));

  await fillDatePickerInput(page, "#so-preliminary-shipment-date", "07.04.2026");
  await fillDatePickerInput(page, "#so-actual-shipment-date", "08.04.2026");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(400);

  const readonlyState = await page.evaluate(() => {
    const text = document.body.textContent || "";
    return {
      url: window.location.href,
      hasPreliminaryLabel: text.includes("Preliminary shipment date"),
      hasActualShipmentLabel: text.includes("Actual shipment date"),
      hasPreliminaryValue: text.includes("2026-04-07"),
      hasActualShipmentValue: text.includes("2026-04-08"),
      hasEditableInputs: Boolean(document.querySelector("#so-preliminary-shipment-date")),
      tabs: Array.from(document.querySelectorAll('[role="tab"]'))
        .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    };
  });

  return { editState, readonlyState };
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

    const purchaseOrder = await verifyPurchaseOrder(page);
    const salesOrder = await verifySalesOrder(page);

    const result = { purchaseOrder, salesOrder };
    const outPath = path.join(process.cwd(), "tmp", "po-so-scheduling-fields-verification.json");
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
