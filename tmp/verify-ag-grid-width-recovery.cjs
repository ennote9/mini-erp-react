const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:1420";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function measureGridGap(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".erp-ag-grid");
    if (!root) return { ok: false, reason: "grid-root-not-found" };
    const headerViewport = root.querySelector(".ag-header-viewport");
    const headerContainer = root.querySelector(".ag-header-container");
    const centerViewport = root.querySelector(".ag-center-cols-viewport");
    const centerContainer = root.querySelector(".ag-center-cols-container");
    if (!headerViewport || !headerContainer || !centerViewport || !centerContainer) {
      return { ok: false, reason: "ag-elements-missing" };
    }
    const hv = headerViewport.getBoundingClientRect();
    const hc = headerContainer.getBoundingClientRect();
    const cv = centerViewport.getBoundingClientRect();
    const cc = centerContainer.getBoundingClientRect();
    return {
      ok: true,
      headerViewportWidth: Math.round(hv.width),
      headerContainerWidth: Math.round(hc.width),
      centerViewportWidth: Math.round(cv.width),
      centerContainerWidth: Math.round(cc.width),
      headerGap: Math.round(hv.width - hc.width),
      centerGap: Math.round(cv.width - cc.width),
    };
  });
}

function assertNoStaleNarrowLayout(measure, label) {
  if (!measure.ok) {
    throw new Error(`[${label}] Measurement failed: ${measure.reason}`);
  }
  // stale bug signature: viewport much wider than internal container
  if (measure.centerGap > 80 || measure.headerGap > 80) {
    throw new Error(
      `[${label}] stale narrow layout detected: headerGap=${measure.headerGap}, centerGap=${measure.centerGap}, viewport=${measure.centerViewportWidth}, container=${measure.centerContainerWidth}`,
    );
  }
}

async function openListAndWait(page, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
  await page.waitForTimeout(350);
}

async function toggleSidebarBrand(page) {
  const candidates = [
    "button[aria-label*='боковую панель' i]",
    "button[aria-label*='sidebar' i]",
    "[data-sidebar-brand-trigger='true']",
    ".sidebar-brand-trigger",
    "aside button:has-text('Мини ERP')",
  ];
  for (const sel of candidates) {
    const node = page.locator(sel).first();
    if (await node.count()) {
      await node.click();
      await page.waitForTimeout(280);
      return true;
    }
  }

  // fallback: click first focusable element in sidebar header area
  const fallback = page.locator("aside button, aside [role='button']").first();
  if (await fallback.count()) {
    await fallback.click();
    await page.waitForTimeout(280);
    return true;
  }
  return false;
}

async function run() {
  ensureDir(path.join(process.cwd(), "tmp"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1600, height: 980 },
  });
  const page = await context.newPage();

  const result = {
    verified: [],
    notes: [],
    consoleErrors: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") result.consoleErrors.push(msg.text());
  });

  // Scenario A: /items back navigation and shell width changes
  await openListAndWait(page, "/items");
  let measure = await measureGridGap(page);
  assertNoStaleNarrowLayout(measure, "items-initial");
  result.verified.push({ step: "items-initial", measure });

  const firstDataRow = page.locator(".erp-ag-grid .ag-center-cols-container .ag-row").first();
  if (await firstDataRow.count()) {
    await firstDataRow.click();
    await page.waitForTimeout(350);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".erp-ag-grid .ag-root-wrapper", { timeout: 15000 });
    await page.waitForTimeout(450);
    measure = await measureGridGap(page);
    assertNoStaleNarrowLayout(measure, "items-after-back");
    result.verified.push({ step: "items-after-back", measure });
  } else {
    result.notes.push("items: no row available for detail/back navigation check");
  }

  await page.setViewportSize({ width: 1360, height: 980 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1680, height: 980 });
  await page.waitForTimeout(450);
  measure = await measureGridGap(page);
  assertNoStaleNarrowLayout(measure, "items-after-resize");
  result.verified.push({ step: "items-after-resize", measure });

  const toggled = await toggleSidebarBrand(page);
  if (toggled) {
    measure = await measureGridGap(page);
    assertNoStaleNarrowLayout(measure, "items-after-sidebar-toggle-1");
    result.verified.push({ step: "items-after-sidebar-toggle-1", measure });
    await toggleSidebarBrand(page);
    measure = await measureGridGap(page);
    assertNoStaleNarrowLayout(measure, "items-after-sidebar-toggle-2");
    result.verified.push({ step: "items-after-sidebar-toggle-2", measure });
  } else {
    result.notes.push("sidebar toggle not found; skipped sidebar width change check");
  }

  // Scenario D: manual resize protection on /items
  const codeHeader = page.locator('.erp-ag-grid .ag-header-cell[col-id="code"]').first();
  if (await codeHeader.count()) {
    const beforeWidth = await codeHeader.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const resizeHandle = page.locator('.erp-ag-grid .ag-header-cell[col-id="code"] .ag-header-cell-resize').first();
    if (await resizeHandle.count()) {
      const box = await resizeHandle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(250);
        const afterManualWidth = await codeHeader.evaluate((el) => Math.round(el.getBoundingClientRect().width));
        await page.setViewportSize({ width: 1500, height: 980 });
        await page.waitForTimeout(300);
        await page.setViewportSize({ width: 1680, height: 980 });
        await page.waitForTimeout(350);
        const afterResizeWidth = await codeHeader.evaluate((el) => Math.round(el.getBoundingClientRect().width));
        const drift = Math.abs(afterResizeWidth - afterManualWidth);
        if (drift > 8) {
          throw new Error(
            `[items-manual-resize] column width was overridden after viewport change: manual=${afterManualWidth}, afterResize=${afterResizeWidth}, drift=${drift}`,
          );
        }
        result.verified.push({
          step: "items-manual-resize-protection",
          beforeWidth,
          afterManualWidth,
          afterResizeWidth,
          drift,
        });
      }
    }
  } else {
    result.notes.push("items: code column not found for manual resize protection check");
  }

  // Scenario C: additional pages with width-fill expectation
  await openListAndWait(page, "/stock-balances");
  measure = await measureGridGap(page);
  assertNoStaleNarrowLayout(measure, "stock-balances-initial");
  result.verified.push({ step: "stock-balances-initial", measure });

  await openListAndWait(page, "/sales-orders");
  measure = await measureGridGap(page);
  assertNoStaleNarrowLayout(measure, "sales-orders-initial");
  result.verified.push({ step: "sales-orders-initial", measure });

  await openListAndWait(page, "/purchase-orders");
  measure = await measureGridGap(page);
  assertNoStaleNarrowLayout(measure, "purchase-orders-initial");
  result.verified.push({ step: "purchase-orders-initial", measure });

  const outputPath = path.join(process.cwd(), "tmp", "ag-grid-width-recovery-verification.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
  await page.screenshot({ path: path.join(process.cwd(), "tmp", "ag-grid-width-recovery-items.png"), fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, outputPath, result }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
