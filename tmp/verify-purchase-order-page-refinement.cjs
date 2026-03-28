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

async function verifyPurchaseOrder(page, locale) {
  await applyLocale(page, locale);
  await page.goto(`${APP_ROOT}/purchase-orders/1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");

  const titleState = await page.evaluate(() => ({
    url: window.location.href,
    topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
    header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
    detailsDescription: (
      document.querySelector(".doc-page [data-slot='card-description']")?.textContent || ""
    ).trim(),
  }));

  const receiptActionState = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll(".doc-header__actions button"));
    const receiptButton = buttons.find((button) =>
      /Create receipt|Оформить поступление|Создать поступление/.test(button.textContent || ""),
    );
    return {
      text: (receiptButton?.textContent || "").trim(),
      disabled: receiptButton ? receiptButton.hasAttribute("disabled") : null,
    };
  });

  const paymentTabName = locale === "ru" ? "Оплата" : "Payments";
  await page.getByRole("tab", { name: paymentTabName }).click();
  await page.waitForTimeout(150);

  const paymentState = await page.evaluate(() => ({
    inlineAmountInputs: document.querySelectorAll("#po-pay-amount").length,
    recordPaymentButtons: Array.from(document.querySelectorAll("button"))
      .map((node) => (node.textContent || "").trim())
      .filter((text) => /Record payment|Зафиксировать оплату/.test(text)),
  }));

  await page.getByRole("button", {
    name: locale === "ru" ? "Зафиксировать оплату" : "Record payment",
  }).click();
  await page.waitForSelector('[role="dialog"]');

  const paymentDialogState = await page.evaluate(() => ({
    title: (document.querySelector('[role="dialog"] [role="heading"], [role="dialog"] h2')?.textContent || "").trim(),
    hasAmount: Boolean(document.querySelector('[role="dialog"] #po-pay-amount')),
    hasMethod: Boolean(document.querySelector('[role="dialog"] #po-pay-method')),
  }));

  await page.getByRole("button", { name: locale === "ru" ? "Отмена" : "Cancel" }).click();
  await page.waitForTimeout(150);

  const attachmentsTabName = locale === "ru" ? "Вложения" : "Attachments";
  await page.getByRole("tab", { name: attachmentsTabName }).click();
  await page.waitForTimeout(150);

  const attachmentRowsBefore = await page.locator("tbody tr").count();
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.join(process.cwd(), "package.json"));
  await page.waitForTimeout(300);
  const attachmentRowsAfterAdd = await page.locator("tbody tr").count();

  page.once("dialog", (dialog) => dialog.accept());
  const removeButtonName = locale === "ru" ? "Удалить вложение" : "Remove attachment";
  await page.getByRole("button", { name: removeButtonName }).first().click();
  await page.waitForTimeout(300);
  const attachmentRowsAfterRemove = await page.locator("tbody tr").count();

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

  const centeredGridState = await page.evaluate(() => {
    const header = document.querySelector(".doc-lines-grid--po .ag-header-cell.po-grid-header--center .ag-header-cell-label");
    const cell = document.querySelector(".doc-lines-grid--po .ag-cell.po-grid-cell--center");
    return {
      headerJustifyContent: header ? window.getComputedStyle(header).justifyContent : null,
      cellTextAlign: cell ? window.getComputedStyle(cell).textAlign : null,
    };
  });

  await page.screenshot({
    path: path.join(process.cwd(), "tmp", `purchase-order-${locale}-page-refinement.png`),
    fullPage: true,
  });

  return {
    titleState,
    receiptActionState,
    paymentState,
    paymentDialogState,
    attachmentRowsBefore,
    attachmentRowsAfterAdd,
    attachmentRowsAfterRemove,
    stickyTotalsState,
    centeredGridState,
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

    const en = await verifyPurchaseOrder(page, "en");
    const ru = await verifyPurchaseOrder(page, "ru");

    const result = { en, ru };
    const outPath = path.join(process.cwd(), "tmp", "purchase-order-page-refinement-verification.json");
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
