const { chromium } = require("playwright");

async function textExists(page, text) {
  return (await page.getByText(text, { exact: true }).count()) > 0;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: "http://127.0.0.1:1420" });

  const result = {
    itemHasStyleField: null,
    warehouseHasStylePolicy: null,
    warehouseStylePolicyValue: null,
    stockBalancesHasStyleHeader: null,
    stockBalancesHasStyleFilter: null,
    stockBalancesFirstStyleCell: null,
  };

  await page.goto("/items/1", { waitUntil: "networkidle" });
  result.itemHasStyleField = await textExists(page, "Style");

  await page.goto("/warehouses/1", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /warehouse settings/i }).click();
  result.warehouseHasStylePolicy = await textExists(page, "Warehouse Style Policy");
  const stylePolicyTrigger = page.locator("#warehouse-style-policy");
  result.warehouseStylePolicyValue = await stylePolicyTrigger.textContent();

  await page.goto("/stock-balances", { waitUntil: "networkidle" });
  result.stockBalancesHasStyleHeader = await textExists(page, "Style");
  result.stockBalancesHasStyleFilter = await textExists(page, "All styles");
  const firstDataRow = page.locator(".ag-center-cols-container .ag-row").first();
  if ((await firstDataRow.count()) > 0) {
    const styleCell = firstDataRow.locator('[col-id="style"]').first();
    result.stockBalancesFirstStyleCell = ((await styleCell.textContent()) || "").trim();
  }

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
