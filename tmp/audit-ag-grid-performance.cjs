const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:1420";

async function waitGrid(page) {
  await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function getGridSnapshot(page, colId) {
  return page.evaluate((targetColId) => {
    const root = document.querySelector(".erp-ag-grid");
    if (!root) return null;
    const rows = root.querySelectorAll(".ag-center-cols-container .ag-row").length;
    const headers = root.querySelectorAll(".ag-header-cell").length;
    const centerViewport = root.querySelector(".ag-center-cols-viewport");
    const centerContainer = root.querySelector(".ag-center-cols-container");
    const vw = centerViewport ? Math.round(centerViewport.getBoundingClientRect().width) : null;
    const cw = centerContainer ? Math.round(centerContainer.getBoundingClientRect().width) : null;
    const headerCells = Array.from(root.querySelectorAll(`.ag-header-cell[col-id="${targetColId}"]`));
    const colWidth = headerCells.reduce((max, el) => {
      const w = Math.round(el.getBoundingClientRect().width);
      return w > max ? w : max;
    }, 0);
    return { rows, headers, viewportWidth: vw, containerWidth: cw, deadGap: vw != null && cw != null ? vw - cw : null, colWidth };
  }, colId);
}

async function measureSearchInteraction(page, query) {
  const start = Date.now();
  await page.locator(".list-page-search__input").first().fill(query);
  await page.waitForTimeout(20);
  await page.waitForFunction(
    (q) => {
      const input = document.querySelector(".list-page-search__input");
      return input && input.value === q;
    },
    query,
    { timeout: 10000 },
  );
  await page.waitForTimeout(250);
  const end = Date.now();
  return end - start;
}

function makeFilterUrl(route, colId, operator, value) {
  const encoded = encodeURIComponent(`${colId}~${operator}~${encodeURIComponent(value)}`);
  return `${BASE_URL}${route}?cf=${encoded}`;
}

async function collectMutationBurst(page, interactionFn) {
  await page.evaluate(() => {
    const root = document.querySelector(".erp-ag-grid .ag-center-cols-container");
    window.__gridMut = { count: 0, attrs: 0 };
    if (!root) return;
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        window.__gridMut.count += 1;
        if (m.type === "attributes") window.__gridMut.attrs += 1;
      }
    });
    obs.observe(root, { childList: true, subtree: true, attributes: true });
    window.__gridMutObs = obs;
  });
  await interactionFn();
  await page.waitForTimeout(150);
  const mut = await page.evaluate(() => {
    const data = window.__gridMut || { count: -1, attrs: -1 };
    if (window.__gridMutObs) window.__gridMutObs.disconnect();
    return data;
  });
  return mut;
}

async function auditPage(page, route, colIdForWidth, colIdForFilter) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await waitGrid(page);

  const baseline = await getGridSnapshot(page, colIdForWidth);
  const searchMs = await collectMutationBurst(page, async () => {
    await measureSearchInteraction(page, "zzzz-no-match-123");
  });
  const afterSearch = await getGridSnapshot(page, colIdForWidth);

  const clearSearchMs = await measureSearchInteraction(page, "");
  const filterNavStart = Date.now();
  await page.goto(makeFilterUrl(route, colIdForFilter, "contains", "zzzz-no-match-filter"), {
    waitUntil: "domcontentloaded",
  });
  await waitGrid(page);
  const filterNavMs = Date.now() - filterNavStart;
  const afterFilter = await getGridSnapshot(page, colIdForWidth);

  // width-change recovery check
  await page.setViewportSize({ width: 1360, height: 980 });
  await page.waitForTimeout(250);
  await page.setViewportSize({ width: 1680, height: 980 });
  await page.waitForTimeout(400);
  const afterResize = await getGridSnapshot(page, colIdForWidth);

  return {
    route,
    baseline,
    afterSearch,
    afterFilter,
    afterResize,
    interaction: {
      searchMutation: searchMs,
      clearSearchMs,
      filterNavigationMs: filterNavMs,
    },
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1600, height: 980 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const results = {
    generatedAt: new Date().toISOString(),
    pages: [],
    consoleErrors,
  };

  results.pages.push(await auditPage(page, "/items", "code", "code"));
  results.pages.push(await auditPage(page, "/sales-orders", "number", "number"));
  results.pages.push(await auditPage(page, "/stock-balances", "itemCode", "itemCode"));

  const out = path.join(process.cwd(), "tmp", "ag-grid-performance-audit-runtime.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2), "utf8");
  await page.screenshot({ path: path.join(process.cwd(), "tmp", "ag-grid-performance-audit-runtime.png"), fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, out, results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
