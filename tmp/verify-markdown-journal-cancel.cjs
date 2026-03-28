const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = process.env.APP_URL || "http://127.0.0.1:1420";
const OUT_PATH = path.join(process.cwd(), "tmp", "verify-markdown-journal-cancel.json");

async function textAll(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .map((node) => (node.textContent || "").trim())
      .filter(Boolean),
  );
}

async function selectOptionByText(selectLocator, text) {
  const options = await selectLocator.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.value,
      label: (node.textContent || "").trim(),
    })),
  );
  const match = options.find((option) => option.label.includes(text));
  if (!match) {
    throw new Error(`Option containing "${text}" not found.`);
  }
  await selectLocator.selectOption(match.value);
}

async function openMarkdownJournalList(page) {
  await page.goto(`${BASE_URL}/markdown-journal`, { waitUntil: "networkidle" });
  await page.waitForSelector(
    ".list-page__controls-stack, .ag-root-wrapper, .empty-state, .ag-root",
    { timeout: 15000 },
  );
}

async function openStockBalancesForItem(page, itemId) {
  await page.goto(`${BASE_URL}/stock-balances?itemId=${itemId}`, { waitUntil: "networkidle" });
  await page.waitForSelector(
    ".list-page__controls-stack, .ag-root-wrapper, .empty-state, .ag-root",
    { timeout: 15000 },
  );
}

async function captureBalanceRows(page) {
  const rows = [];
  const rowLocators = page.locator(".ag-center-cols-container .ag-row");
  const count = await rowLocators.count();
  for (let i = 0; i < count; i += 1) {
    const row = rowLocators.nth(i);
    const cells = await row.locator(".ag-cell").evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent || "").trim()),
    );
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const result = {
    baseUrl: BASE_URL,
  };

  await openStockBalancesForItem(page, "1");
  result.stockBalancesBefore = await captureBalanceRows(page);

  await page.goto(`${BASE_URL}/markdown-journal/new?itemId=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#markdown-source-warehouse", { timeout: 15000 });

  await selectOptionByText(page.locator("#markdown-source-warehouse"), "WH-001");
  await selectOptionByText(page.locator("#markdown-target-warehouse"), "WH-002");
  await page.fill("#markdown-line-qty", "1");
  await page.fill("#markdown-line-price", "12.5");
  await page.locator("#markdown-line-reason").selectOption("OTHER");
  await page.getByRole("button", { name: /add line/i }).click();
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/markdown-journal\/journals\/\d+/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  const draftUrl = page.url();
  const pageText = (await page.locator("body").textContent()) || "";
  const journalNumberMatch = pageText.match(/MJ\d{8}/);
  const journalNumber = journalNumberMatch ? journalNumberMatch[0] : "";
  result.draftUrl = draftUrl;
  result.journalNumber = journalNumber;
  result.statusBeforeCancel = (await page.locator("text=/Draft|Черновик|Жоба/").first().textContent()).trim();

  result.postButtonBeforeCancel = await page.getByRole("button", { name: /post|провести|жүргізу/i }).count();
  result.printButtonBeforeCancel = await page.getByRole("button", { name: /print stickers|печать стикеров|стикерлерді басып шығару/i }).count();

  await page.getByRole("button", { name: /cancel journal|отменить журнал|журналды болдырмау/i }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);

  result.statusAfterCancel = (await page.locator("text=/Cancelled|Отменён|Болдырылмаған/").first().textContent()).trim();
  result.cancelledHintVisible = await page.getByText(/closed|закрыт|жабық/i).count();
  result.postButtonAfterCancel = await page.getByRole("button", { name: /post|провести|жүргізу/i }).count();
  result.printButtonAfterCancel = await page.getByRole("button", { name: /print stickers|печать стикеров|стикерлерді басып шығару/i }).count();
  result.lineEditorAfterCancel = await page.locator("#markdown-line-item").count();
  result.cancelledTimestampVisible = await page.getByText(/Cancelled at|Отменено|Болдырылған уақыты/).count();

  await page.locator('a[href="/markdown-journal"]').first().click();
  await page.waitForURL(/\/markdown-journal(?:\?.*)?$/, { timeout: 15000 });
  await page.waitForSelector(
    ".list-page__controls-stack, .ag-root-wrapper, .empty-state, .ag-root",
    { timeout: 15000 },
  );
  const registerTextsBeforeFilter = await textAll(page, ".ag-center-cols-container .ag-row .ag-cell");
  result.registerTextsBeforeFilter = registerTextsBeforeFilter;
  result.registerRowCountBeforeFilter = await page.locator(".ag-center-cols-container .ag-row").count();
  if (!result.journalNumber) {
    const registerNumber = registerTextsBeforeFilter.find((text) => /^MJ\d{8}$/.test(text));
    if (registerNumber) result.journalNumber = registerNumber;
  }
  result.registerContainsJournalNumber = result.journalNumber
    ? registerTextsBeforeFilter.includes(result.journalNumber)
    : false;
  result.registerContainsCancelled = registerTextsBeforeFilter.some((text) =>
    /Cancelled|Отменён|Болдырылмаған/.test(text),
  );

  await page.getByRole("button", { name: /cancelled|отменён|болдырылмаған/i }).click();
  await page.waitForTimeout(300);
  result.filteredJournalRowsAfterCancel = await captureBalanceRows(page);
  result.filteredRegisterContainsJournalNumber = result.journalNumber
    ? result.filteredJournalRowsAfterCancel.some((row) => row.includes(result.journalNumber))
    : false;
  result.filteredRegisterContainsCancelled = result.filteredJournalRowsAfterCancel.some((row) =>
    row.some((cell) => /Cancelled|Отменён|Болдырылмаған/.test(cell)),
  );

  await page.goto(`${BASE_URL}/markdown-journal?view=codes`, { waitUntil: "networkidle" });
  await page.waitForSelector(
    ".list-page__controls-stack, .ag-root-wrapper, .empty-state, .ag-root",
    { timeout: 15000 },
  );
  if (result.journalNumber) {
    await page.locator(".list-page-search__input").fill(result.journalNumber);
    await page.waitForTimeout(300);
  }
  const codeGridTexts = await textAll(page, ".ag-center-cols-container .ag-row .ag-cell");
  result.codesRowCount = await page.locator(".ag-center-cols-container .ag-row").count();
  result.codesContainJournalNumber = result.journalNumber
    ? codeGridTexts.includes(result.journalNumber)
    : false;

  await openStockBalancesForItem(page, "1");
  result.stockBalancesAfter = await captureBalanceRows(page);

  await browser.close();
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
