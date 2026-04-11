const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:1420";

async function getColWidth(page, colId) {
  return page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`.erp-ag-grid .ag-header-cell[col-id="${id}"]`));
    if (nodes.length === 0) return -1;
    let max = 0;
    for (const node of nodes) {
      const w = Math.round(node.getBoundingClientRect().width);
      if (w > max) max = w;
    }
    return max;
  }, colId);
}

async function getDeadGap(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".erp-ag-grid");
    if (!root) return { ok: false, reason: "root-missing" };
    const viewport = root.querySelector(".ag-center-cols-viewport");
    const container = root.querySelector(".ag-center-cols-container");
    if (!viewport || !container) return { ok: false, reason: "ag-nodes-missing" };
    const vw = Math.round(viewport.getBoundingClientRect().width);
    const cw = Math.round(container.getBoundingClientRect().width);
    return { ok: true, viewport: vw, container: cw, deadGap: vw - cw };
  });
}

async function openColumnFilterOnItemsCode(page) {
  const header = page.locator('.erp-ag-grid .ag-header-cell[col-id="code"]').first();
  await header.waitFor({ timeout: 10000 });
  const btn = header.locator('button[aria-label*="menu" i], button[aria-label*="колон" i]').first();
  await btn.click();
  await page.waitForTimeout(200);
}

async function applyItemsCodeContainsFilter(page, value) {
  await openColumnFilterOnItemsCode(page);
  const input = page.locator('input[type="text"]').filter({ hasNotText: "" }).first();
  await input.fill(value);
  const okBtn = page.locator('button:has-text("OK"), button:has-text("ОК")').first();
  await okBtn.click();
  await page.waitForTimeout(350);
}

async function setSearch(page, value) {
  const input = page.locator(".list-page-search__input").first();
  await input.waitFor({ timeout: 10000 });
  await input.fill(value);
  await page.waitForTimeout(350);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1600, height: 980 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const report = { items: {}, salesOrders: {}, consoleErrors };

  await page.goto(`${BASE_URL}/items`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
  await page.waitForTimeout(350);

  const baseCodeWidth = await getColWidth(page, "code");
  report.items.baseCodeWidth = baseCodeWidth;

  await applyItemsCodeContainsFilter(page, "ZZZ-NO-MATCH-XYZ");
  const afterFilterCodeWidth = await getColWidth(page, "code");
  report.items.afterFilterCodeWidth = afterFilterCodeWidth;
  if (Math.abs(afterFilterCodeWidth - baseCodeWidth) > 2) {
    throw new Error(`items: column width changed after filter (${baseCodeWidth} -> ${afterFilterCodeWidth})`);
  }

  await setSearch(page, "abc-no-match-search");
  const afterSearchCodeWidth = await getColWidth(page, "code");
  report.items.afterSearchCodeWidth = afterSearchCodeWidth;
  if (Math.abs(afterSearchCodeWidth - baseCodeWidth) > 2) {
    throw new Error(`items: column width changed after search (${baseCodeWidth} -> ${afterSearchCodeWidth})`);
  }

  await page.setViewportSize({ width: 1360, height: 980 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1680, height: 980 });
  await page.waitForTimeout(450);
  const gapAfterResize = await getDeadGap(page);
  report.items.gapAfterResize = gapAfterResize;
  if (!gapAfterResize.ok || gapAfterResize.deadGap > 24) {
    throw new Error(`items: dead right gap returned after width change (${JSON.stringify(gapAfterResize)})`);
  }

  // fresh state for manual-resize scenario
  await page.goto(`${BASE_URL}/items`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
  await page.waitForTimeout(350);

  const codeHeader = page.locator('.erp-ag-grid .ag-header-cell[col-id="code"]').first();
  if ((await codeHeader.count()) < 1) {
    throw new Error("items: code header not found for manual resize");
  }
  const codeHeaderBox = await codeHeader.boundingBox();
  if (!codeHeaderBox) throw new Error("items: code header not found for manual resize");
  const startX = codeHeaderBox.x + codeHeaderBox.width - 2;
  const startY = codeHeaderBox.y + codeHeaderBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 110, startY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const manualWidth = await getColWidth(page, "code");
  report.items.manualWidth = manualWidth;
  await setSearch(page, "");
  await setSearch(page, "item");
  const afterManualSearchWidth = await getColWidth(page, "code");
  report.items.afterManualSearchWidth = afterManualSearchWidth;
  if (Math.abs(afterManualSearchWidth - manualWidth) > 3) {
    throw new Error(
      `items: manual width was overridden by search/filter operations (${manualWidth} -> ${afterManualSearchWidth})`,
    );
  }

  await page.goto(`${BASE_URL}/sales-orders`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
  await page.waitForTimeout(350);
  const soNumberWidth = await getColWidth(page, "number");
  report.salesOrders.baseNumberWidth = soNumberWidth;
  await setSearch(page, "zzzzzz-no-match");
  const soAfterSearchWidth = await getColWidth(page, "number");
  report.salesOrders.afterSearchWidth = soAfterSearchWidth;
  if (Math.abs(soAfterSearchWidth - soNumberWidth) > 2) {
    throw new Error(`sales-orders: column width changed after search (${soNumberWidth} -> ${soAfterSearchWidth})`);
  }

  const out = path.join(process.cwd(), "tmp", "ag-grid-filter-width-stability-verification.json");
  fs.writeFileSync(out, JSON.stringify({ ok: true, report }, null, 2), "utf8");
  await page.screenshot({ path: path.join(process.cwd(), "tmp", "ag-grid-filter-width-stability.png"), fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, out, report }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
