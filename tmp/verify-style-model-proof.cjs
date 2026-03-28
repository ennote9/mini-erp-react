const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:1420";
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
      locale: "ru",
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

async function seedSettings(context) {
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: JSON.stringify(SETTINGS) },
  );
}

async function spaNavigate(page, nextPath) {
  await page.evaluate((next) => {
    window.history.pushState({}, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, nextPath);
}

async function waitUntilEnabled(locator, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(150);
  }
  throw new Error("Timed out waiting for control to become enabled.");
}

async function openSelectAndPick(page, triggerSelector, optionLabel) {
  await page.locator(triggerSelector).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

async function readGridRows(page, fieldNames) {
  await page.waitForTimeout(500);
  const rowCount = await page.locator(".ag-center-cols-container .ag-row").count();
  if (rowCount === 0) return [];
  return page.locator(".ag-center-cols-container .ag-row").evaluateAll(
    (rows, fields) =>
      rows.map((row) => {
        const out = {};
        for (const field of fields) {
          const cell = row.querySelector(`[col-id="${field}"]`);
          out[field] = (cell?.textContent || "").trim();
        }
        return out;
      }),
    fieldNames,
  );
}

async function readHeaderTexts(page) {
  await page.waitForTimeout(300);
  return page
    .locator(".ag-header-cell-text")
    .evaluateAll((nodes) => nodes.map((node) => (node.textContent || "").trim()).filter(Boolean));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1480, height: 1200 },
    colorScheme: "dark",
  });
  await seedSettings(context);
  const page = await context.newPage();
  const result = {};

  await page.goto(`${BASE}/warehouses/2`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Настройки склада" }).click();
  result.targetWarehousePolicyBefore = (
    await page.locator("#warehouse-style-policy").textContent()
  )?.trim();
  await openSelectAndPick(page, '[aria-label="Политика стилей склада"]', "Только уценка");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.waitForURL(/\/warehouses$/);

  await page.goto(`${BASE}/purchase-orders/1`, { waitUntil: "networkidle" });
  const confirmButton = page.getByRole("button", { name: "Подтвердить", exact: true });
  if (await confirmButton.count()) {
    await confirmButton.click();
    await page.waitForTimeout(500);
  }
  const createReceiptButton = page.getByRole("button", { name: "Создать поступление" });
  if (!(await createReceiptButton.isEnabled())) {
    await page.goto(`${BASE}/purchase-orders/1`, { waitUntil: "networkidle" });
  }
  await waitUntilEnabled(createReceiptButton);
  await createReceiptButton.click();
  await page.waitForURL(/\/receipts\/\d+/, { timeout: 10000 });
  result.receiptUrl = page.url();
  const postReceiptButton = page.getByRole("button", { name: "Провести", exact: true });
  await waitUntilEnabled(postReceiptButton);
  await postReceiptButton.click();
  await page.waitForTimeout(800);
  result.receiptPostError = (await page.getByRole("alert").count())
    ? ((await page.getByRole("alert").textContent()) || "").trim()
    : null;

  await spaNavigate(page, "/markdown-journal/new?itemId=1");
  await page.waitForSelector("#markdown-line-price");
  result.printButtonBeforePost = await page.getByRole("button", { name: "Печать стикеров" }).count();
  await page.selectOption("#markdown-source-warehouse", "1");
  await page.selectOption("#markdown-target-warehouse", "2");
  await page.locator("#markdown-line-qty").fill("2");
  await page.locator("#markdown-line-price").fill("1");
  await page.getByRole("button", { name: "Добавить строку" }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.waitForURL(/\/markdown-journal\/journals\/\d+/, { timeout: 10000 });
  result.journalUrl = page.url();
  await page.getByRole("button", { name: "Провести", exact: true }).click();
  await page.waitForTimeout(500);
  result.postError = (await page.getByRole("alert").count())
    ? ((await page.getByRole("alert").textContent()) || "").trim()
    : null;
  result.printButtonAfterPost = await page.getByRole("button", { name: "Печать стикеров" }).count();
  result.lineEditorAfterPost = await page.locator("#markdown-line-price").count();

  const lineRows = await readGridRows(page, [
    "itemCode",
    "itemName",
    "quantity",
    "markdownPrice",
    "reason",
  ]);
  result.documentLineRows = lineRows;

  await page.getByRole("tab", { name: "Коды уценки" }).click();
  await page.waitForTimeout(300);
  const codeRows = await readGridRows(page, [
    "markdownCode",
    "itemCode",
    "quantity",
    "markdownPrice",
    "warehouse",
    "status",
  ]);
  result.documentCodeRows = codeRows;

  await spaNavigate(page, "/markdown-journal");
  await page.waitForSelector(".ag-root-wrapper");
  result.journalRegisterHeaders = await readHeaderTexts(page);
  result.journalRegisterRows = await readGridRows(page, [
    "number",
    "status",
    "sourceWarehouseLabel",
    "targetWarehouseLabel",
    "lineCount",
    "totalQty",
  ]);
  await page.getByRole("button", { name: "Коды уценки" }).click();
  await page.waitForTimeout(300);
  result.codesRegisterHeaders = await readHeaderTexts(page);
  result.codesRegisterRows = await readGridRows(page, [
    "markdownCode",
    "journalNumber",
    "itemCode",
    "quantity",
    "warehouseLabel",
    "statusLabel",
  ]);

  await spaNavigate(page, "/stock-balances?itemId=1");
  await page.waitForSelector(".ag-root-wrapper");
  result.stockBalanceRowsBeforeFilter = await readGridRows(page, [
    "itemCode",
    "warehouseName",
    "style",
    "qtyOnHand",
  ]);
  await openSelectAndPick(page, '[aria-label="Фильтр по стилю остатка"]', "Уценка");
  await page.waitForTimeout(300);
  result.stockBalanceRowsAfterMarkdownFilter = await readGridRows(page, [
    "itemCode",
    "warehouseName",
    "style",
    "qtyOnHand",
  ]);

  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "verify-markdown-deep-process.png"),
    fullPage: true,
  });

  await fs.writeFile(
    path.join(process.cwd(), "tmp", "verify-markdown-deep-process.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
