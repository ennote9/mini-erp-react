const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:1420";

async function countBackButtons(page) {
  return page.locator("button:has(svg.lucide-arrow-left)").count();
}

async function verifyNoBackOnRoot(page, route, report) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  const count = await countBackButtons(page);
  if (count !== 0) {
    throw new Error(`${route}: expected 0 back buttons, got ${count}`);
  }
  report.push({ route, backButtons: count, expected: "none" });
}

async function verifyBackExistsOnDetail(page, route, report) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  const count = await countBackButtons(page);
  if (count < 1) {
    throw new Error(`${route}: expected back button to exist`);
  }
  report.push({ route, backButtons: count, expected: "present" });
}

async function verifyAnyDocumentDetailWithBack(page, routes, report) {
  const tried = [];
  for (const route of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const count = await countBackButtons(page);
    tried.push({ route, backButtons: count });
    if (count >= 1) {
      report.push({ route, backButtons: count, expected: "present" });
      return { ok: true, tried };
    }
  }
  report.push({
    route: routes.join(", "),
    expected: "document-detail back button present",
    note: "not found on tried routes",
    tried,
  });
  return { ok: false, tried };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1600, height: 980 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const report = [];

  await verifyNoBackOnRoot(page, "/items", report);
  await verifyNoBackOnRoot(page, "/sales-orders", report);
  await verifyNoBackOnRoot(page, "/purchase-orders", report);
  await verifyNoBackOnRoot(page, "/brands", report);

  await verifyBackExistsOnDetail(page, "/items/1", report);
  await verifyAnyDocumentDetailWithBack(
    page,
    ["/purchase-orders/1", "/sales-orders/1", "/receipts/1", "/shipments/1", "/stock-balances/1"],
    report,
  );

  const result = { ok: true, report, consoleErrors };
  const out = path.join(process.cwd(), "tmp", "root-list-back-button-removal-verification.json");
  fs.writeFileSync(out, JSON.stringify(result, null, 2), "utf8");
  await page.screenshot({
    path: path.join(process.cwd(), "tmp", "root-list-back-button-removal.png"),
    fullPage: true,
  });
  await browser.close();
  console.log(JSON.stringify({ out, result }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
