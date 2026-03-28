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

async function bootstrap(page, locale = "en") {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SETTINGS_KEY, value: buildSettings(locale) },
  );
}

async function getGridRows(page) {
  const hasRows = await page.locator(".ag-center-cols-container .ag-row").first().isVisible().catch(() => false);
  if (!hasRows) return [];
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".ag-center-cols-container .ag-row"));
    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll(".ag-cell"));
      const byColId = Object.fromEntries(
        cells.map((cell) => [cell.getAttribute("col-id") || "", (cell.textContent || "").trim()]),
      );
      return {
        text: (row.textContent || "").replace(/\s+/g, " ").trim(),
        byColId,
        code: byColId.code || "",
        entryType: byColId.entryType || "",
        itemCode: byColId.itemCode || "",
        itemName: byColId.itemName || "",
        active: byColId.isActive || "",
      };
    });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1480, height: 1200 },
      colorScheme: "dark",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await bootstrap(page, "en");

    await page.goto(`${APP_ROOT}/barcodes`, { waitUntil: "networkidle" });
    await page.waitForSelector(".app-topbar__title");

    const initialMeta = await page.evaluate(() => ({
      url: window.location.href,
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      headers: Array.from(document.querySelectorAll(".ag-header-cell .ag-header-cell-text")).map((node) =>
        (node.textContent || "").trim(),
      ),
      buttonTexts: Array.from(document.querySelectorAll("button"))
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean),
    }));

    const initialRows = await getGridRows(page);
    const itemBarcodeRow = initialRows.find((row) => row.entryType === "Item barcode");
    const markdownCodeRow = initialRows.find((row) => row.entryType === "Markdown code");

    const searchTargetCode = markdownCodeRow?.code || itemBarcodeRow?.code || "";
    await page.getByLabel("Search barcode registry by code").fill(searchTargetCode);
    await page.waitForTimeout(350);
    const searchedRows = await getGridRows(page);
    const searchOverlayText = await page.locator(".list-page-search__right-overlay").textContent().catch(() => null);
    await page.getByLabel("Search barcode registry by code").fill("");
    await page.waitForTimeout(200);

    await page.getByLabel("Filter by barcode entry type").selectOption("MARKDOWN_CODE");
    await page.waitForTimeout(250);
    const markdownOnlyRows = await getGridRows(page);
    const markdownOnlyEmptyVisible = (await page.locator(".list-page__empty").count()) > 0;

    await page.getByLabel("Filter by barcode entry type").selectOption("all");
    await page.waitForTimeout(200);

    const itemFilterValue = itemBarcodeRow ? itemBarcodeRow.itemCode : "";
    const itemOptions = await page.getByLabel("Filter by item").locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, text: (node.textContent || "").trim() })),
    );
    const matchingItemOption = itemOptions.find((option) => option.text.startsWith(itemFilterValue));
    if (matchingItemOption) {
      await page.getByLabel("Filter by item").selectOption(matchingItemOption.value);
      await page.waitForTimeout(250);
    }
    const itemFilteredRows = await getGridRows(page);
    await page.getByLabel("Filter by item").selectOption("all");
    await page.waitForTimeout(200);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export", exact: true }).click(),
    ]);
    const suggestedFilename = download.suggestedFilename();
    const downloadPath = path.join(process.cwd(), "tmp", suggestedFilename);
    await download.saveAs(downloadPath);

    const itemRowIndex = initialRows.findIndex((row) => row.entryType === "Item barcode");
    let itemDrilldownPerformed = false;
    if (itemRowIndex >= 0) {
      await page.locator(".ag-center-cols-container .ag-row").nth(itemRowIndex).click();
      await page.waitForURL(/\/items\/\d+$/);
      await page.waitForSelector(".doc-header__title");
      itemDrilldownPerformed = true;
    }
    const itemDrilldown = await page.evaluate(() => ({
      url: window.location.href,
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
    }));

    await page.goto(`${APP_ROOT}/barcodes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const rowsAfterReturn = await getGridRows(page);
    const markdownRowIndex = rowsAfterReturn.findIndex((row) => row.entryType === "Markdown code");
    let markdownDrilldownPerformed = false;
    if (markdownRowIndex >= 0) {
      await page.locator(".ag-center-cols-container .ag-row").nth(markdownRowIndex).click();
      await page.waitForURL(/\/markdown-journal\/journals\/\d+$/);
      markdownDrilldownPerformed = true;
    }
    const markdownDrilldown = await page.evaluate(() => ({
      url: window.location.href,
      topBar: (document.querySelector(".app-topbar__title")?.textContent || "").trim(),
      header: (document.querySelector(".doc-header__title")?.textContent || "").trim(),
    }));

    const result = {
      initialMeta,
      counts: {
        initial: initialRows.length,
        searched: searchedRows.length,
        markdownOnly: markdownOnlyRows.length,
        itemFiltered: itemFilteredRows.length,
      },
      emptyStates: {
        markdownOnlyEmptyVisible,
      },
      sampleRows: {
        itemBarcodeRow,
        markdownCodeRow,
        firstRow: initialRows[0] ?? null,
      },
      searchTargetCode,
      searchOverlayText,
      searchMatch: searchedRows.map((row) => row.code),
      markdownOnlyEntryTypes: [...new Set(markdownOnlyRows.map((row) => row.entryType))],
      itemFilteredItemCodes: [...new Set(itemFilteredRows.map((row) => row.itemCode))],
      export: {
        suggestedFilename,
        savedAs: downloadPath,
      },
      itemDrilldown: {
        performed: itemDrilldownPerformed,
        ...itemDrilldown,
      },
      markdownDrilldown: {
        performed: markdownDrilldownPerformed,
        ...markdownDrilldown,
      },
    };

    await page.goto(`${APP_ROOT}/barcodes`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(process.cwd(), "tmp", "barcode-registry-page.png"),
      fullPage: true,
    });

    const outPath = path.join(process.cwd(), "tmp", "barcode-registry-verification.json");
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
