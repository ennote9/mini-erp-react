const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";

function buildSettings(locale) {
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

async function applyLocale(page, locale) {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SETTINGS_KEY, value: buildSettings(locale) },
  );
}

async function verifyExistingOrder(page, locale) {
  await applyLocale(page, locale);
  await page.goto(`${APP_ROOT}/sales-orders/1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");

  const titleState = await page.evaluate(() => ({
    url: window.location.href,
    topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
    header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
  }));

  const paymentTabName = locale === "ru" ? "Оплата" : "Payments";
  await page.getByRole("tab", { name: paymentTabName }).click();
  await page.waitForTimeout(150);

  const paymentBeforeOpen = await page.evaluate(() => ({
    inlineAmountInputs: document.querySelectorAll("#so-pay-amount").length,
    recordPaymentButtons: Array.from(document.querySelectorAll("button"))
      .map((node) => (node.textContent || "").trim())
      .filter((text) => text.length > 0)
      .filter((text) => /Record payment|Зафиксировать оплату/.test(text)),
  }));

  const recordPaymentButton = page.getByRole("button", {
    name: locale === "ru" ? "Зафиксировать оплату" : "Record payment",
  });
  await recordPaymentButton.click();
  await page.waitForSelector('[role="dialog"]');

  const paymentDialogState = await page.evaluate(() => ({
    dialogTitle: (document.querySelector('[role="dialog"] [data-slot="dialog-title"], [role="dialog"] h2, [role="dialog"] [role="heading"]')?.textContent || "").trim(),
    dialogHasAmountInput: Boolean(document.querySelector('[role="dialog"] #so-pay-amount')),
    dialogHasMethod: Boolean(document.querySelector('[role="dialog"] #so-pay-method')),
  }));

  await page.getByRole("button", { name: locale === "ru" ? "Отмена" : "Cancel" }).click();
  await page.waitForTimeout(150);

  const executionTabName = locale === "ru" ? "Исполнение" : "Execution";
  await page.getByRole("tab", { name: executionTabName }).click();
  await page.waitForTimeout(150);

  const executionState = await page.evaluate(() => {
    const panel = document.querySelector(".doc-so-tab-panel--execution");
    return {
      text: (panel?.textContent || "").replace(/\s+/g, " ").trim(),
      cardTitles: Array.from(panel?.querySelectorAll(".text-base.font-semibold") || [])
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean),
    };
  });

  const linesTabName = locale === "ru" ? "Строки" : "Lines";
  await page.getByRole("tab", { name: linesTabName }).click();
  await page.waitForTimeout(150);

  const stickyTotalsState = await page.evaluate(() => {
    const totals = document.querySelector(".doc-lines__totals--sticky");
    if (!totals) return null;
    const style = window.getComputedStyle(totals);
    return {
      text: (totals.textContent || "").replace(/\s+/g, " ").trim(),
      position: style.position,
      bottom: style.bottom,
    };
  });

  await page.screenshot({
    path: path.join(process.cwd(), "tmp", `sales-order-${locale}-existing-page.png`),
    fullPage: true,
  });

  return {
    titleState,
    paymentBeforeOpen,
    paymentDialogState,
    executionState,
    stickyTotalsState,
  };
}

async function verifyZeroPriceFlow(page) {
  await applyLocale(page, "en");
  await page.goto(`${APP_ROOT}/sales-orders/new`, { waitUntil: "networkidle" });
  await page.waitForSelector("#line-entry-item");

  const unitPriceInput = page.locator("#line-entry-unit-price");
  await unitPriceInput.fill("0");

  const itemInput = page.locator("#line-entry-item");
  await itemInput.fill("ITEM-001");
  await itemInput.press("Enter");
  await page.waitForTimeout(150);

  await unitPriceInput.fill("0");
  await page.waitForTimeout(100);

  const zeroReasonVisibleAtZero = await page.locator("#so-line-entry-zp-reason").count();

  const beforeAddRowCount = await page.locator(".ag-center-cols-container .ag-row").count();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.waitForTimeout(200);

  const zeroPriceValidationState = await page.evaluate(() => ({
    bodyText: document.body.textContent || "",
    rowCount: document.querySelectorAll(".ag-center-cols-container .ag-row").length,
  }));

  const reasonTrigger = page.locator("#so-line-entry-zp-reason");
  await reasonTrigger.click();
  await page.locator('[role="listbox"] button').nth(1).click();
  await page.waitForTimeout(100);

  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.waitForTimeout(250);

  const afterReasonRowCount = await page.locator(".ag-center-cols-container .ag-row").count();

  await unitPriceInput.fill("10");
  await page.waitForTimeout(100);
  const zeroReasonVisibleAtNonZero = await page.locator("#so-line-entry-zp-reason").count();

  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "sales-order-zero-price-flow.png"),
    fullPage: true,
  });

  return {
    beforeAddRowCount,
    zeroReasonVisibleAtZero,
    validationMessageShown: /For each zero-price line/.test(zeroPriceValidationState.bodyText),
    rowCountAfterBlockedAdd: zeroPriceValidationState.rowCount,
    afterReasonRowCount,
    zeroReasonVisibleAtNonZero,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1480, height: 1280 },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    const en = await verifyExistingOrder(page, "en");
    const ru = await verifyExistingOrder(page, "ru");
    const zeroPrice = await verifyZeroPriceFlow(page);

    const result = { en, ru, zeroPrice };
    const outPath = path.join(process.cwd(), "tmp", "sales-order-page-refinement-verification.json");
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
