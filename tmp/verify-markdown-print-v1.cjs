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
};

async function seedSettings(context) {
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: JSON.stringify(SETTINGS) },
  );
  await context.addInitScript(() => {
    window.__markdownPrintLog = [];
    window.open = () => {
      const state = { html: "" };
      return {
        document: {
          write(chunk) {
            state.html += chunk;
          },
          close() {},
        },
        focus() {},
        print() {
          const labelCount = (state.html.match(/class="sticker"/g) || []).length;
          window.__markdownPrintLog.push({
            labelCount,
            html: state.html,
          });
        },
      };
    };
  });
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

async function readGridRows(page, fieldNames) {
  await page.waitForTimeout(400);
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

async function scrollGridToRight(page) {
  const viewport = page.locator(".ag-center-cols-viewport").first();
  if ((await viewport.count()) === 0) return;
  await viewport.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await page.waitForTimeout(250);
}

async function addMarkdownDraftLine(page, qty, price) {
  await page.waitForSelector("#markdown-line-price");
  await page.selectOption("#markdown-source-warehouse", "1");
  await page.selectOption("#markdown-target-warehouse", "1");
  await page.locator("#markdown-line-qty").fill(String(qty));
  await page.locator("#markdown-line-price").fill(String(price));
  await page.locator("#markdown-line-reason").selectOption("OTHER");
  await page.getByRole("button", { name: /add line/i }).click();
}

async function ensureGoodStock(page, result) {
  await page.goto(`${BASE}/purchase-orders/1`, { waitUntil: "networkidle" });
  const confirmButton = page.getByRole("button", { name: "Confirm", exact: true });
  if (await confirmButton.count()) {
    const enabled = await confirmButton.isEnabled().catch(() => false);
    if (enabled) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }
  }
  const createReceiptButton = page.getByRole("button", { name: "Create receipt" });
  if (await createReceiptButton.count()) {
    const enabled = await createReceiptButton.isEnabled().catch(() => false);
    if (enabled) {
      await createReceiptButton.click();
      await page.waitForURL(/\/receipts\/\d+/, { timeout: 10000 });
      result.receiptUrl = page.url();
      const postReceiptButton = page.getByRole("button", { name: "Post", exact: true });
      await waitUntilEnabled(postReceiptButton);
      await postReceiptButton.click();
      await page.waitForTimeout(800);
      result.receiptPostError = (await page.getByRole("alert").count())
        ? ((await page.getByRole("alert").textContent()) || "").trim()
        : null;
    }
  }
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

  await ensureGoodStock(page, result);

  await spaNavigate(page, "/markdown-journal/new?itemId=1");
  await page.waitForSelector("#markdown-source-warehouse");
  await addMarkdownDraftLine(page, 1, 1);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/markdown-journal\/journals\/\d+/, { timeout: 10000 });
  result.draftJournalUrl = page.url();
  result.draftPrintButtonCount = await page.getByRole("button", { name: "Print labels" }).count();
  await page.getByRole("button", { name: "Cancel journal" }).click();
  await page.waitForTimeout(500);
  result.cancelledStatusVisible = await page.getByText("Cancelled", { exact: true }).count();
  result.cancelledPrintButtonCount = await page.getByRole("button", { name: "Print labels" }).count();

  await spaNavigate(page, "/markdown-journal/new?itemId=1");
  await page.waitForSelector("#markdown-source-warehouse");
  await addMarkdownDraftLine(page, 2, 1);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/markdown-journal\/journals\/\d+/, { timeout: 10000 });
  result.postedJournalUrl = page.url();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.waitForTimeout(700);
  result.postError = (await page.getByRole("alert").count())
    ? ((await page.getByRole("alert").textContent()) || "").trim()
    : null;
  result.postedPrintButtonCount = await page.getByRole("button", { name: "Print labels" }).count();

  await page.getByRole("tab", { name: "Markdown Codes" }).click();
  await page.waitForTimeout(400);
  await scrollGridToRight(page);
  result.codeRowsBeforePrint = await readGridRows(page, [
    "markdownCode",
    "quantity",
    "printCount",
    "printedAt",
  ]);

  await spaNavigate(page, "/stock-balances?itemId=1");
  await page.waitForSelector(".ag-root-wrapper, .ag-root");
  result.stockRowsBeforePrint = await readGridRows(page, [
    "warehouseName",
    "style",
    "qtyOnHand",
  ]);

  await spaNavigate(page, result.postedJournalUrl.replace(BASE, ""));
  await page.waitForSelector(".doc-header__title");
  await page.getByRole("tab", { name: "Markdown Codes" }).click();
  await page.waitForTimeout(400);

  const firstCheckbox = page.locator(".ag-center-cols-container .ag-row .ag-selection-checkbox").first();
  await firstCheckbox.click();
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: "Print labels" }).click();
  result.printDialogAllSummary = ((await page.getByText(/Print all generated labels:/).textContent()) || "").trim();
  result.printDialogSelectedSummary = ((await page.getByText(/Print selected labels:/).textContent()) || "").trim();
  await page.getByRole("button", { name: "Print all journal codes" }).click();
  await page.waitForTimeout(500);

  result.printLogAfterAll = await page.evaluate(() => window.__markdownPrintLog);
  await scrollGridToRight(page);
  result.codeRowsAfterPrintAll = await readGridRows(page, [
    "markdownCode",
    "quantity",
    "printCount",
    "printedAt",
  ]);

  await firstCheckbox.click();
  await page.waitForTimeout(100);
  await firstCheckbox.click();
  await page.waitForTimeout(100);

  await page.getByRole("button", { name: "Print labels" }).click();
  await page.getByRole("button", { name: "Print selected codes" }).click();
  await page.waitForTimeout(500);

  result.printLogAfterSelected = await page.evaluate(() => window.__markdownPrintLog);
  await scrollGridToRight(page);
  result.codeRowsAfterPrintSelected = await readGridRows(page, [
    "markdownCode",
    "quantity",
    "printCount",
    "printedAt",
  ]);

  await spaNavigate(page, "/stock-balances?itemId=1");
  await page.waitForSelector(".ag-root-wrapper, .ag-root");
  result.stockRowsAfterPrint = await readGridRows(page, [
    "warehouseName",
    "style",
    "qtyOnHand",
  ]);

  await fs.writeFile(
    path.join(process.cwd(), "tmp", "verify-markdown-print-v1.json"),
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
