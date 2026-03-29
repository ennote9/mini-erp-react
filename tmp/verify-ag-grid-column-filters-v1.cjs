const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(process.cwd(), "tmp", "ag-grid-column-filters-v1-verification.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForGrid(page) {
  await page.locator(".ag-root-wrapper").first().waitFor({ state: "visible" });
}

async function hasVisibleGrid(page) {
  return (await page.locator(".ag-root-wrapper").count()) > 0;
}

async function openHeaderFilter(page, headerLabel) {
  const headerCell = page.locator(".ag-header-cell").filter({ hasText: headerLabel }).first();
  await headerCell.waitFor({ state: "visible" });
  const filterButton = headerCell.getByRole("button").first();
  await filterButton.click({ force: true });
  const okButton = page.getByRole("button", { name: "OK" }).last();
  await okButton.waitFor({ state: "visible" });
  const popup = okButton.locator('xpath=ancestor::div[contains(@class,"p-3")][1]');
  return { headerCell, popup };
}

async function closePopupWithReset(page) {
  const reset = page.getByRole("button", { name: "Reset" }).last();
  if (await reset.count()) await reset.click();
}

async function readOperatorValues(popup) {
  const operatorSelect = popup.locator("select").first();
  return await operatorSelect.evaluate((node) =>
    Array.from(node.options).map((option) => option.value),
  );
}

async function readOperatorLabels(popup) {
  const operatorSelect = popup.locator("select").first();
  return await operatorSelect.evaluate((node) =>
    Array.from(node.options).map((option) => option.textContent?.trim() || ""),
  );
}

async function verifyItemsFlow(page, results) {
  await page.goto(`${BASE_URL}/items`, { waitUntil: "domcontentloaded" });
  await waitForGrid(page);

  const firstCode = ((await page.locator('.ag-cell[col-id="code"]').first().textContent()) || "").trim();
  assert(firstCode !== "", "Expected first item code to exist");

  const { headerCell, popup } = await openHeaderFilter(page, "Code");
  const headerButtonsBeforeFilter = await headerCell.getByRole("button").count();
  const headerHtmlBeforeFilter = await headerCell.innerHTML();
  const menuButtonName = await headerCell.getByRole("button").first().getAttribute("aria-label");
  const textOperators = await readOperatorValues(popup);
  const textOperatorLabels = await readOperatorLabels(popup);
  assert(textOperators.includes("contains"), "Items Code filter missing contains");
  assert(textOperators.includes("starts_with"), "Items Code filter missing starts_with");
  assert(textOperators.includes("in"), "Items Code filter missing in");
  assert(headerButtonsBeforeFilter === 1, "Items Code header should only have one column-menu trigger");
  assert(
    headerHtmlBeforeFilter.includes("chevron-down"),
    "Items Code header did not render downward-arrow menu trigger",
  );
  assert(
    !headerHtmlBeforeFilter.includes("arrow-up-down") &&
      !headerHtmlBeforeFilter.includes("arrow-up") &&
      !headerHtmlBeforeFilter.includes("arrow-down"),
    "Items Code header still showed separate sort icons",
  );
  assert(menuButtonName === "Column menu", "Items column-menu trigger label was not localized");
  assert(
    (await popup.getByText("Sort and filter this column").count()) > 0,
    "Items column menu description was not localized",
  );
  assert((await popup.getByText("Sort").count()) > 0, "Items sort section label was not localized");
  assert((await popup.getByText("Filter").count()) > 0, "Items filter section label was not localized");
  assert((await popup.getByText("Operator").count()) > 0, "Items operator label was not localized");
  assert(!((await popup.textContent()) || "").includes("filterTitle"), "Items popup still showed raw filterTitle key");
  assert(
    textOperatorLabels.includes("Contains") &&
      textOperatorLabels.includes("Starts with") &&
      textOperatorLabels.includes("One of") &&
      textOperatorLabels.includes("Not one of"),
    "Items text operators were not localized with user-facing labels",
  );
  assert(
    textOperatorLabels.every((label) => !label.includes("_")),
    "Items popup still showed raw technical operator keys",
  );

  const selects = popup.locator("select");
  await selects.first().selectOption("equals");
  await popup.locator("input").first().fill(firstCode);
  await popup.getByRole("button", { name: "OK" }).click();

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
  const itemsUrlAfterFilter = page.url();
  const itemFilterParams = new URL(itemsUrlAfterFilter).searchParams.getAll("cf");
  assert(itemFilterParams.length > 0, "Items filter did not persist in URL");

  const headerHtmlAfterApply = await headerCell.innerHTML();
  assert(
    headerHtmlAfterApply.includes("text-primary") && headerHtmlAfterApply.includes("bg-primary"),
    "Items header did not show active filter state",
  );

  const visibleCodesAfterFilter = await page.locator('.ag-cell[col-id="code"]').allTextContents();
  assert(
    visibleCodesAfterFilter.map((value) => value.trim()).includes(firstCode),
    "Items grid did not show filtered code",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForGrid(page);
  assert(page.url().includes("cf="), "Items filter did not survive refresh");

  const itemRow = page.locator(".ag-center-cols-container .ag-row").first();
  await itemRow.click();
  await page.waitForURL(/\/items\/.+/);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await waitForGrid(page);
  assert(page.url().includes("cf="), "Items filter did not survive detail -> back");

  const reopenedForSort = await openHeaderFilter(page, "Code");
  await reopenedForSort.popup.getByRole("button", { name: "Sort ascending" }).click();
  await page.waitForTimeout(300);
  const sortUrlAfterClick = page.url();
  assert(new URL(sortUrlAfterClick).searchParams.get("sort"), "Items sort action did not update sort state");
  await reopenedForSort.popup.getByRole("button", { name: "Clear sort" }).click();
  await page.waitForTimeout(300);
  await reopenedForSort.popup.getByRole("button", { name: "Reset" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  assert(new URL(page.url()).searchParams.getAll("cf").length === 0, "Items reset did not clear URL filters");
  assert(!new URL(page.url()).searchParams.get("sort"), "Items clear sort did not clear URL sort");

  results.items = {
    firstCode,
    textOperators,
    textOperatorLabels,
    headerButtonsBeforeFilter,
    itemsUrlAfterFilter,
    backRestoredFilter: true,
    sortUrlAfterClick,
  };
}

async function verifyOperatorSets(page, route, checks, resultKey, results) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  if (!(await hasVisibleGrid(page))) {
    results[resultKey] = { route, skippedEmpty: true };
    return;
  }
  await waitForGrid(page);
  const pageResult = {};

  for (const check of checks) {
    const { popup } = await openHeaderFilter(page, check.header);
    const operators = await readOperatorValues(popup);
    const operatorLabels = await readOperatorLabels(popup);
    for (const expected of check.includes || []) {
      assert(operators.includes(expected), `${route} ${check.header} missing operator ${expected}`);
    }
    for (const unexpected of check.excludes || []) {
      assert(!operators.includes(unexpected), `${route} ${check.header} unexpectedly had operator ${unexpected}`);
    }
    pageResult[check.header] = { operators, operatorLabels };
    await popup.getByRole("button", { name: "Reset" }).click();
  }

  results[resultKey] = pageResult;
}

async function verifyHeaderOpenOnly(page, route, headerLabel, resultKey, results) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  if (!(await hasVisibleGrid(page))) {
    results[resultKey] = { route, headerLabel, skippedEmpty: true };
    return;
  }
  await waitForGrid(page);
  const { popup } = await openHeaderFilter(page, headerLabel);
  const title = ((await popup.textContent()) || "").trim();
  assert(title.includes(headerLabel), `${route} popup did not include header label ${headerLabel}`);
  await popup.getByRole("button", { name: "Reset" }).click();
  results[resultKey] = { route, headerLabel, popupOpened: true };
}

async function verifyEnumMultiSelectFlow(page, results) {
  await page.goto(`${BASE_URL}/sales-orders`, { waitUntil: "domcontentloaded" });
  if (!(await hasVisibleGrid(page))) {
    results.salesOrdersEnumMultiselect = { route: "/sales-orders", skippedEmpty: true };
    return;
  }
  await waitForGrid(page);

  const { popup } = await openHeaderFilter(page, "Status");
  const operatorLabels = await readOperatorLabels(popup);
  assert(operatorLabels.includes("One of"), "Sales Orders Status menu did not localize One of");
  assert(operatorLabels.includes("Not one of"), "Sales Orders Status menu did not localize Not one of");

  await popup.locator("select").first().selectOption("in");
  const searchInput = popup.getByPlaceholder("Search values");
  await searchInput.waitFor({ state: "visible" });
  const checkboxes = popup.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  assert(checkboxCount > 0, "Sales Orders Status One of did not render checkbox multiselect");

  await checkboxes.first().check({ force: true });
  const firstOptionLabel = ((await popup.locator("label span").first().textContent()) || "").trim();
  await popup.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  assert(
    new URL(page.url()).searchParams.getAll("cf").length > 0,
    "Sales Orders Status One of did not persist filter in URL",
  );

  const reopened = await openHeaderFilter(page, "Status");
  await reopened.popup.getByRole("button", { name: "Reset" }).click();

  results.salesOrdersEnumMultiselect = {
    operatorLabels,
    checkboxCount,
    firstOptionLabel,
    searchPlaceholderVisible: true,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const results = {
    baseUrl: BASE_URL,
    verifiedAt: new Date().toISOString(),
  };

  try {
    await verifyItemsFlow(page, results);

    await verifyOperatorSets(
      page,
      "/sales-orders",
      [
        {
          header: "Status",
          includes: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
          excludes: ["contains"],
        },
      ],
      "salesOrders",
      results,
    );
    await verifyEnumMultiSelectFlow(page, results);

    await verifyOperatorSets(
      page,
      "/purchase-orders",
      [
        {
          header: "Number",
          includes: ["contains", "equals", "starts_with"],
          excludes: ["gt"],
        },
      ],
      "purchaseOrders",
      results,
    );

    await verifyOperatorSets(
      page,
      "/stock-balances",
      [
        {
          header: "Total quantity",
          includes: ["eq", "gt", "gte", "between", "not_between"],
          excludes: ["contains"],
        },
      ],
      "stockBalances",
      results,
    );

    await verifyOperatorSets(
      page,
      "/markdown-journal",
      [
        {
          header: "Number",
          includes: ["contains", "equals", "in"],
          excludes: ["gt"],
        },
      ],
      "markdownJournal",
      results,
    );

    await verifyOperatorSets(
      page,
      "/barcodes",
      [
        {
          header: "Type",
          includes: ["equals", "not_equals", "in", "not_in"],
          excludes: ["contains"],
        },
      ],
      "barcodeRegistry",
      results,
    );

    await verifyOperatorSets(
      page,
      "/brands",
      [
        {
          header: "Active",
          includes: ["is_true", "is_false", "is_empty", "is_not_empty"],
          excludes: ["contains", "equals"],
        },
      ],
      "brands",
      results,
    );

    await verifyHeaderOpenOnly(page, "/categories", "Code", "categories", results);
    await verifyHeaderOpenOnly(page, "/suppliers", "Code", "suppliers", results);
    await verifyHeaderOpenOnly(page, "/customers", "Code", "customers", results);
    await verifyHeaderOpenOnly(page, "/warehouses", "Code", "warehouses", results);
    await verifyHeaderOpenOnly(page, "/carriers", "Code", "carriers", results);
    await verifyHeaderOpenOnly(page, "/receipts", "Number", "receipts", results);
    await verifyHeaderOpenOnly(page, "/shipments", "Number", "shipments", results);
    await verifyHeaderOpenOnly(page, "/stock-movements", "Date/time", "stockMovements", results);

    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
