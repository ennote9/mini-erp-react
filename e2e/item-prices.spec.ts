import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:1420";

/** Dev-only browser API (`src/dev/e2eHarness.ts`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type E2eApi = any;

async function gotoOk(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  test.skip(!res?.ok(), `Dev app not reachable at ${url} (start npm run dev on 1420)`);
}

async function waitE2e(page: Page) {
  await page.waitForFunction(
    () => Boolean((window as Window & { __MINI_ERP_E2E__?: unknown }).__MINI_ERP_E2E__),
    undefined,
    { timeout: 60_000 },
  );
}

/** After full navigation the in-memory repository bootstraps async; wait until items are readable. */
async function waitItemsRepositoryHydrated(page: Page) {
  await waitE2e(page);
  await page.waitForFunction(
    () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      try {
        return Boolean(w && w.itemRepository.list().length > 0);
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 60_000 },
  );
}

async function gotoReady(page: Page, pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE.replace(/\/$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  await gotoOk(page, url);
  await waitItemsRepositoryHydrated(page);
}

async function openApp(page: Page) {
  await gotoReady(page, "/");
}

async function firstItemId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
    const rows = w.itemRepository.list();
    if (rows.length === 0) throw new Error("No items in repository");
    return rows[0].id;
  });
}

/** Popover `SelectField` / `ul[role=listbox]` — NOT native `<select><option>`. */
async function pickListboxFirstOption(page: Page, triggerSelector: string) {
  await page.locator(triggerSelector).click();
  const listbox = page.locator("ul[role='listbox']").first();
  await listbox.waitFor({ state: "visible", timeout: 15_000 });
  await listbox.getByRole("option").first().click();
}

async function pickSelectFieldOption(page: Page, triggerSelector: string, name: string | RegExp) {
  await page.locator(triggerSelector).click();
  const listbox = page.locator("ul[role='listbox']").first();
  await listbox.waitFor({ state: "visible", timeout: 15_000 });
  await listbox.getByRole("option", { name }).first().click();
}

/** PO/SO line item combobox (`PurchaseOrderItemAutocomplete` / `SalesOrderItemAutocomplete`). */
async function pickLineEntryItemOption(page: Page, nameMatch: RegExp) {
  const listbox = page.locator("#line-entry-item-listbox");
  await listbox.waitFor({ state: "visible", timeout: 15_000 });
  const row = listbox.locator('li[role="option"]').filter({ hasText: nameMatch }).first();
  await row.click({ timeout: 15_000 });
}

async function waitItemTabsVisible(page: Page) {
  await page.getByTestId("item-tab-main").waitFor({ state: "visible", timeout: 60_000 });
}

async function waitNewItemFormVisible(page: Page) {
  await page.locator("#item-name").waitFor({ state: "visible", timeout: 60_000 });
}

async function waitPoEditorVisible(page: Page) {
  await page.locator("#po-supplier").waitFor({ state: "visible", timeout: 60_000 });
}

async function waitSoEditorVisible(page: Page) {
  await page.locator("#so-customer").waitFor({ state: "visible", timeout: 60_000 });
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** `DatePickerField`: visible text is dd.MM.yyyy; parent state updates on blur. */
function ymdToDdMmYyyy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

async function setPoDateFromYmd(page: Page, ymd: string) {
  await page.locator("#po-date").fill(ymdToDdMmYyyy(ymd));
  await page.locator("#po-date").blur();
}

/** Single "add line" — distinct from "Add lines" (import). Title includes Alt+A in all locales. */
async function clickAddSingleLineButton(page: Page) {
  await page.locator('button[title*="Alt+A"]').first().click();
}

/** Price History defaults collapsed; expand so the TanStack table is visible for assertions. */
async function expandItemPriceHistorySection(page: Page) {
  const toggle = page.getByTestId("item-prices-history-toggle");
  await toggle.waitFor({ state: "visible", timeout: 15_000 });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
    await page.getByTestId("item-prices-history-table").waitFor({ state: "visible", timeout: 15_000 });
  }
}

test.describe("Item card — Prices tab (acceptance)", () => {
  test.describe.configure({ timeout: 90_000 });
  test("6.1 tabs regression: Main / Prices / Images / Barcodes / Testers; main has no legacy price fields; utility buttons", async ({
    page,
  }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await expect(page.getByTestId("item-tab-prices")).toBeVisible();
    await expect(page.getByTestId("item-tab-responsibles")).toBeVisible();
    await expect(page.getByTestId("item-tab-images")).toBeVisible();
    await expect(page.getByTestId("item-tab-barcodes")).toBeVisible();
    await expect(page.getByTestId("item-tab-testers")).toBeVisible();

    await expect(page.getByRole("button", { name: /stock balances|остатки|қалдықтар/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /stock movements|движения|жылжымалар/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /markdown|уценк|markdown/i })).toBeVisible();

    await page.getByTestId("item-tab-main").click();
    await expect(page.locator("#item-purchasePrice")).toHaveCount(0);
    await expect(page.locator("#item-salePrice")).toHaveCount(0);

    await page.getByTestId("item-tab-prices").click();
    await expect(page.getByTestId("item-prices-summary-grid")).toBeVisible({ timeout: 15_000 });
  });

  test("6.2 unsaved new item: Prices tab blocked", async ({ page }) => {
    await openApp(page);
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expect(page.getByTestId("item-prices-unsaved-hint")).toBeVisible({ timeout: 15_000 });
  });

  test("6.3 first save: stays on /items/:id and Prices becomes usable", async ({ page }) => {
    await openApp(page);
    const code = `E2E-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Acceptance ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/items/\\d+`), {
      timeout: 20_000,
    });
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expect(page.getByTestId("item-prices-summary-grid")).toBeVisible({ timeout: 15_000 });
  });

  test("6.4 current purchase price: summary, history, active, snapshot", async ({ page }) => {
    await openApp(page);
    const code = `E2E-P-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Price test ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    const url = page.url();
    const itemId = url.match(/\/items\/([^/?#]+)/)?.[1];
    expect(itemId).toBeTruthy();

    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);
    await page.getByTestId("item-price-amount-input").fill("12.34");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-prices-card-purchase-current")).toContainText("12.34");
    await expandItemPriceHistorySection(page);
    await expect(page.getByTestId("item-prices-history-table")).toContainText(/Active|Активна|Белсенді/i);

    const snap = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { itemRepository: { getById: (x: string) => { purchasePrice?: number } } } })
        .__MINI_ERP_E2E__;
      return w?.itemRepository.getById(id)?.purchasePrice;
    }, itemId!);
    expect(snap).toBeCloseTo(12.34, 2);
  });

  test("6.5 scheduled sale: next summary, scheduled row, sale snapshot unchanged", async ({ page }) => {
    await openApp(page);
    const code = `E2E-SCH-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Sched ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    const url = page.url();
    const itemId = url.match(/\/items\/([^/?#]+)/)?.[1]!;

    await waitItemTabsVisible(page);

    const saleBefore = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { itemRepository: { getById: (x: string) => { salePrice?: number } } } })
        .__MINI_ERP_E2E__;
      return w?.itemRepository.getById(id)?.salePrice;
    }, itemId);

    await page.getByTestId("item-tab-prices").click();
    const future = addDaysYmd(new Date().toISOString().slice(0, 10), 40);
    await page.getByTestId("item-prices-add-sale").click();
    await page.getByTestId("item-price-amount-input").fill("88.90");
    await page.getByTestId("item-price-valid-from-input").fill(future);
    await page.getByTestId("item-price-reason-select").selectOption("commercial_review");
    await page.getByTestId("item-price-dialog-submit").click();

    await expect(page.getByTestId("item-prices-card-sale-next")).toContainText("88.90");
    await expandItemPriceHistorySection(page);
    await expect(page.getByTestId("item-prices-history-table")).toContainText(/Scheduled|Запланирована|Жоспарланған/i);

    const saleAfter = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { itemRepository: { getById: (x: string) => { salePrice?: number } } } })
        .__MINI_ERP_E2E__;
      return w?.itemRepository.getById(id)?.salePrice;
    }, itemId);
    expect(saleAfter).toEqual(saleBefore);
  });

  test("6.6 replace scheduled sale: confirm, old cancelled, new scheduled, both in history", async ({ page }) => {
    await openApp(page);
    const code = `E2E-REP-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Replace ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });

    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    const future1 = addDaysYmd(new Date().toISOString().slice(0, 10), 50);
    const future2 = addDaysYmd(new Date().toISOString().slice(0, 10), 60);

    await page.getByTestId("item-prices-add-sale").click();
    await page.getByTestId("item-price-amount-input").fill("50.00");
    await page.getByTestId("item-price-valid-from-input").fill(future1);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();

    await page.getByTestId("item-prices-add-sale").click();
    await page.getByTestId("item-price-amount-input").fill("60.00");
    await page.getByTestId("item-price-valid-from-input").fill(future2);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();

    await expect(page.getByTestId("item-price-replace-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-replace-confirm").click();

    await expect(page.getByTestId("item-prices-card-sale-next")).toContainText("60.00");
    await expandItemPriceHistorySection(page);
    const rows = page.locator('[data-testid="item-prices-history-row"]');
    await expect(rows.filter({ hasText: /Cancelled|Отменена|Болдырылған/i })).toHaveCount(1);
    await expect(rows.filter({ hasText: /Scheduled|Запланирована|Жоспарланған/i })).toHaveCount(1);
  });

  test("6.7 cancel scheduled purchase: toolbar cancel, summary clears, active unchanged", async ({ page }) => {
    await openApp(page);
    const code = `E2E-CAN-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Cancel ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    const url = page.url();
    const itemId = url.match(/\/items\/([^/?#]+)/)?.[1]!;

    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await page.getByTestId("item-prices-add-purchase").click();
    await page.getByTestId("item-price-amount-input").fill("3.00");
    await page.getByTestId("item-price-valid-from-input").fill(addDaysYmd(new Date().toISOString().slice(0, 10), 10));
    await page.getByTestId("item-price-reason-select").selectOption("supplier_change");
    await page.getByTestId("item-price-dialog-submit").click();

    const purchaseBefore = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { itemRepository: { getById: (x: string) => { purchasePrice?: number } } } })
        .__MINI_ERP_E2E__;
      return w?.itemRepository.getById(id)?.purchasePrice;
    }, itemId);

    await page.getByTestId("item-prices-cancel-scheduled-purchase").click();
    await expect(page.getByTestId("item-price-cancel-dialog")).toBeVisible();
    await page.getByTestId("item-price-cancel-confirm").click();

    await expect(page.getByTestId("item-prices-card-purchase-next")).toContainText(
      /Not scheduled|Не запланирована|Жоспарланбаған/i,
    );
    const purchaseAfter = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { itemRepository: { getById: (x: string) => { purchasePrice?: number } } } })
        .__MINI_ERP_E2E__;
      return w?.itemRepository.getById(id)?.purchasePrice;
    }, itemId);
    expect(purchaseAfter).toEqual(purchaseBefore);
  });

  test("6.8 validation: negative, past date, reason; zero allowed", async ({ page }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await page.getByTestId("item-prices-add-purchase").click();
    await page.getByTestId("item-price-amount-input").fill("-1");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-validation-error")).toBeVisible();

    await page.getByTestId("item-price-amount-input").fill("10");
    const past = addDaysYmd(new Date().toISOString().slice(0, 10), -3);
    await page.getByTestId("item-price-valid-from-input").fill(past);
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-validation-error")).toBeVisible();

    const todayYmd = new Date().toISOString().slice(0, 10);
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });
  });

  test("6.9 PO: default line price from effective purchase by document date; not retroactive", async ({ page }) => {
    await openApp(page);
    const eff = await page.evaluate(async () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const it = w.itemRepository.list().find((i: { code: string }) => i.code === "ITEM-001");
      if (!it) throw new Error("ITEM-001 missing");
      const docDate = new Date().toISOString().slice(0, 10);
      await w.applyItemPriceAwaitPersist(it.id, "purchase", {
        amount: 44.44,
        validFromYmd: docDate,
        reasonCode: "manual_update",
      });
      await w.flushAll();
      return { itemId: it.id, expected: w.getEffectiveItemBasePriceOrZero(it.id, "purchase", docDate) };
    });

    await gotoReady(page, "/purchase-orders/new");
    await waitPoEditorVisible(page);
    await pickListboxFirstOption(page, "#po-supplier");
    await pickListboxFirstOption(page, "#po-warehouse");
    await page.locator("#line-entry-item").fill("ITEM-001");
    await pickLineEntryItemOption(page, /ITEM-001/);
    await expect(page.locator("#line-entry-unit-price")).toHaveValue(String(eff.expected));
    await page.locator("#line-entry-qty").fill("1");
    await clickAddSingleLineButton(page);

    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/purchase-orders\/\d+/, { timeout: 20_000 });
    const poId = page.url().match(/\/purchase-orders\/([^/?#]+)/)?.[1]!;

    const linePriceBefore = await page.evaluate((id: string) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return w.purchaseOrderRepository.listLines(id)[0]?.unitPrice;
    }, poId);

    await page.evaluate(
      async ({ itemId, ymd }: { itemId: string; ymd: string }) => {
        const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
        await w.applyItemPriceAwaitPersist(itemId, "purchase", {
          amount: 123.45,
          validFromYmd: ymd,
          reasonCode: "correction",
        });
        await w.flushAll();
      },
      { itemId: eff.itemId, ymd: new Date().toISOString().slice(0, 10) },
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    const linePriceAfter = await page.evaluate((id: string) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return w.purchaseOrderRepository.listLines(id)[0]?.unitPrice;
    }, poId);
    expect(linePriceAfter).toBe(linePriceBefore);
  });

  test("6.10 SO: agreement discount on effective base; line not retroactive", async ({ page }) => {
    await openApp(page);
    await page.evaluate(async () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const c = w.customerRepository.list()[0];
      if (!c) throw new Error("no customer");
      w.customerAgreementRepository.create({
        customerId: c.id,
        agreementNo: `E2E-${Date.now()}`,
        name: "E2E discount",
        startDate: "2000-01-01",
        isActive: true,
        currency: "USD",
        pricingType: "discount_percent",
        discountPercent: 10,
      });
      await w.flushAll();
    });

    const { itemId, base } = await page.evaluate(async () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const it = w.itemRepository.list().find((i: { code: string }) => i.code === "ITEM-002")!;
      const d = new Date().toISOString().slice(0, 10);
      await w.applyItemPriceAwaitPersist(it.id, "sale", {
        amount: 100,
        validFromYmd: d,
        reasonCode: "manual_update",
      });
      await w.flushAll();
      const b = w.getEffectiveItemBasePriceOrZero(it.id, "sale", d);
      return { itemId: it.id, base: b };
    });

    const { customerLabel } = await page.evaluate(() => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const c = w.customerRepository.list()[0]!;
      return { customerLabel: `${c.code} - ${c.name}` };
    });

    await gotoReady(page, "/sales-orders/new");
    await waitSoEditorVisible(page);
    await pickSelectFieldOption(page, "#so-customer", customerLabel);
    await pickListboxFirstOption(page, "#so-warehouse");
    await page.locator("#line-entry-item").fill("ITEM-002");
    await pickLineEntryItemOption(page, /ITEM-002/);
    const expected = Math.round(base * 0.9 * 100) / 100;
    await expect(page.locator("#line-entry-unit-price")).toHaveValue(String(expected));

    await page.locator("#line-entry-qty").fill("1");
    await clickAddSingleLineButton(page);
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/sales-orders\/\d+/, { timeout: 20_000 });
    const soId = page.url().match(/\/sales-orders\/([^/?#]+)/)?.[1]!;

    const saved = await page.evaluate((id: string) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return w.salesOrderRepository.listLines(id)[0]?.unitPrice;
    }, soId);

    await page.evaluate(
      async ({ id }: { id: string }) => {
        const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
        const ymd = new Date().toISOString().slice(0, 10);
        await w.applyItemPriceAwaitPersist(id, "sale", { amount: 3, validFromYmd: ymd, reasonCode: "correction" });
        await w.flushAll();
      },
      { id: itemId },
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    const after = await page.evaluate((id: string) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return w.salesOrderRepository.listLines(id)[0]?.unitPrice;
    }, soId);
    expect(after).toBe(saved);
  });

  test("6.11 markdown overrides base sale on SO line", async ({ page }) => {
    await openApp(page);
    await gotoReady(page, "/sales-orders/new");
    await waitSoEditorVisible(page);
    const { md, customerLabel, warehouseLabel } = await page.evaluate(async () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const wh = w!.warehouseRepository.list()[0]!;
      const it = w!.itemRepository.list().find((i: { code: string }) => i.code === "ITEM-003")!;
      const c = w!.customerRepository.list()[0]!;
      const rec = w!.markdownRepository.create({
        itemId: it.id,
        markdownPrice: 2.5,
        reasonCode: "OTHER",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        createdBy: "e2e",
        warehouseId: wh.id,
        style: "MARKDOWN",
        printCount: 0,
        quantity: 1,
      });
      await w!.flushAll();
      return {
        md: rec.markdownCode,
        customerLabel: `${c.code} - ${c.name}`,
        warehouseLabel: `${wh.code} - ${wh.name}`,
      };
    });

    await pickSelectFieldOption(page, "#so-customer", customerLabel);
    await pickSelectFieldOption(page, "#so-warehouse", warehouseLabel);
    await page.locator("#line-entry-item").fill(md);
    await page.locator("#line-entry-item-listbox").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#line-entry-item-option-md").click();
    await expect(page.locator("#line-entry-unit-price")).toHaveValue(/2\.5/);
  });

  test("6.12 date-sensitive: effective purchase differs before and after future price start", async ({ page }) => {
    await openApp(page);
    const t = new Date().toISOString().slice(0, 10);
    const future = addDaysYmd(t, 45);
    const { code, pEarly, pLate } = await page.evaluate(
      async ({ early, late }: { early: string; late: string }) => {
        const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
        const it = w.itemRepository.create({
          code: `E2E-DATE-${Date.now()}`,
          name: "Date pricing",
          uom: "EA",
          isActive: true,
          images: [],
          itemKind: "SELLABLE",
        });
        await w.applyItemPriceAwaitPersist(it.id, "purchase", { amount: 11, validFromYmd: early, reasonCode: "manual_update" });
        await w.applyItemPriceAwaitPersist(it.id, "purchase", {
          amount: 22,
          validFromYmd: late,
          reasonCode: "commercial_review",
        });
        await w.flushAll();
        return {
          itemId: it.id,
          code: it.code,
          pEarly: w.getEffectiveItemBasePriceOrZero(it.id, "purchase", early),
          pLate: w.getEffectiveItemBasePriceOrZero(it.id, "purchase", late),
        };
      },
      { early: t, late: future },
    );

    expect(pEarly).toBe(11);
    expect(pLate).toBe(22);

    await gotoReady(page, "/purchase-orders/new");
    await waitPoEditorVisible(page);
    await pickListboxFirstOption(page, "#po-supplier");
    await pickListboxFirstOption(page, "#po-warehouse");
    await setPoDateFromYmd(page, t);
    await page.locator("#line-entry-item").fill(code);
    await pickLineEntryItemOption(page, new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.locator("#line-entry-unit-price")).toHaveValue("11");

    await setPoDateFromYmd(page, future);
    await page.locator("#line-entry-item").fill("");
    await page.locator("#line-entry-item").fill(code);
    await pickLineEntryItemOption(page, new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.locator("#line-entry-unit-price")).toHaveValue("22");
  });

  test("6.13 persistence: reload keeps history and summaries", async ({ page }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    const before = await page.getByTestId("item-prices-history-table").textContent();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    const after = await page.getByTestId("item-prices-history-table").textContent();
    expect(after?.length ?? 0).toBeGreaterThan(10);
    expect(before).toEqual(after);
  });

  test("13.1 history TanStack: sort by amount changes row order", async ({ page }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await page.evaluate(async (id: string) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const ymd = new Date().toISOString().slice(0, 10);
      await w!.applyItemPriceAwaitPersist(id, "purchase", {
        amount: 1.01,
        validFromYmd: ymd,
        reasonCode: "correction",
      });
      await w!.applyItemPriceAwaitPersist(id, "sale", {
        amount: 9.99,
        validFromYmd: ymd,
        reasonCode: "correction",
      });
      await w!.flushAll();
    }, itemId);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);

    const readAmounts = () =>
      page.$$eval('[data-testid="item-prices-history-row"]', (rows) =>
        rows.map((r) => (r.querySelectorAll("td")[1]?.textContent ?? "").replace(/\s/g, "").trim()),
      );

    const before = await readAmounts();
    expect(before.length).toBeGreaterThanOrEqual(2);

    await page.getByTestId("item-prices-history-sort-amount").click();
    const afterDesc = await readAmounts();
    await page.getByTestId("item-prices-history-sort-amount").click();
    const afterAsc = await readAmounts();

    expect(afterDesc[0] !== afterAsc[0] || afterDesc.join() !== afterAsc.join()).toBeTruthy();
  });

  test("13.2 history TanStack: type column filter purchase only", async ({ page }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);

    await page.getByTestId("item-prices-history-filter-priceType").click();
    const panel = page.locator('[data-slot="popover-content"]').last();
    await panel.locator("select").nth(1).selectOption("purchase");
    await panel.getByRole("button", { name: /apply|применить|қолдану/i }).click();

    await expect(page.getByTestId("item-prices-history-filter-priceType")).toHaveClass(/text-primary/);

    const types = await page.$$eval('[data-testid="item-prices-history-row"]', (rows) =>
      rows.map((r) => (r.querySelectorAll("td")[0]?.textContent ?? "").trim()),
    );
    for (const cell of types) {
      expect(cell.toLowerCase()).not.toMatch(/sale|продаж|сату/i);
    }

    await page.getByTestId("item-prices-history-filter-priceType").click();
    const panel2 = page.locator('[data-slot="popover-content"]').last();
    await panel2.getByRole("button", { name: /reset|сброс|қалпына|default/i }).click();
    await expect(page.getByTestId("item-prices-history-filter-priceType")).not.toHaveClass(/text-primary/);
  });

  test("13.2a price history: toggle collapses and expands; sorting state preserved", async ({ page }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    const toggle = page.getByTestId("item-prices-history-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("item-prices-history-table")).toBeHidden();

    await expandItemPriceHistorySection(page);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.getByTestId("item-prices-history-sort-amount").click();
    const sortAfterChange = await page.evaluate(() =>
      window.localStorage.getItem("mini-erp:item-prices-history:sorting:v1"),
    );

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("item-prices-history-table")).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("item-prices-history-table")).toBeVisible({ timeout: 15_000 });

    const sortAfterToggle = await page.evaluate(() =>
      window.localStorage.getItem("mini-erp:item-prices-history:sorting:v1"),
    );
    expect(sortAfterToggle).toBe(sortAfterChange);
  });

  test("13.3 history TanStack: cancel scheduled still works after sort", async ({ page }) => {
    await openApp(page);
    const code = `E2E-13-3-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`TanStack sort cancel ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });

    await waitItemTabsVisible(page);
    const future = addDaysYmd(new Date().toISOString().slice(0, 10), 20);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("5.55");
    await page.getByTestId("item-price-valid-from-input").fill(future);
    await page.getByTestId("item-price-reason-select").selectOption("supplier_change");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await expect(page.getByTestId("item-prices-card-purchase-next")).toContainText("5.55", { timeout: 15_000 });
    await expect(page.getByTestId("item-prices-cancel-scheduled-purchase")).toBeVisible({ timeout: 10_000 });

    const sortAmount = page.getByTestId("item-prices-history-sort-amount");
    await sortAmount.scrollIntoViewIfNeeded();
    await sortAmount.click();
    await sortAmount.click();

    await page.getByTestId("item-prices-cancel-scheduled-purchase").click();
    await expect(page.getByTestId("item-price-cancel-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-cancel-confirm").click();
    await expect(page.getByTestId("item-price-cancel-dialog")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId("item-prices-card-purchase-next")).toContainText(
      /Not scheduled|Не запланирована|Жоспарланбаған/i,
    );
  });

  test("13.4 price history layout: internal scroll, sticky header, sort/filter/resize, narrow horizontal scroll", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 560 });
    await openApp(page);
    const itemId = await firstItemId(page);
    const today = new Date().toISOString().slice(0, 10);
    await page.evaluate(
      async ({ id, t }: { id: string; t: string }) => {
        const w = (window as Window & { __MINI_ERP_E2E?: E2eApi }).__MINI_ERP_E2E__;
        for (let i = 0; i < 18; i++) {
          await w!.applyItemPriceAwaitPersist(id, "purchase", {
            amount: 1 + i * 0.01,
            validFromYmd: t,
            reasonCode: "correction",
          });
        }
        await w!.flushAll();
      },
      { id: itemId, t: today },
    );

    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    const scroll = page.locator("[data-item-prices-history-scroll]");
    await scroll.waitFor({ state: "visible", timeout: 30_000 });
    const table = page.getByTestId("item-prices-history-table");
    await expect(table).toBeVisible();

    const overflowY = await scroll.evaluate((el) => getComputedStyle(el).overflowY);
    expect(["auto", "scroll"].includes(overflowY)).toBeTruthy();

    const metrics = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const beforeSticky = await scroll.evaluate((el) => {
      const thead = el.querySelector("thead");
      if (!thead) return null;
      const er = el.getBoundingClientRect();
      const tr = thead.getBoundingClientRect();
      return tr.top - er.top;
    });
    expect(beforeSticky != null && beforeSticky >= 0 && beforeSticky < 4).toBeTruthy();

    await scroll.evaluate((el) => {
      el.scrollTop = 120;
    });
    const afterSticky = await scroll.evaluate((el) => {
      const thead = el.querySelector("thead");
      if (!thead) return null;
      const er = el.getBoundingClientRect();
      const tr = thead.getBoundingClientRect();
      return tr.top - er.top;
    });
    expect(afterSticky != null && afterSticky >= 0 && afterSticky < 4).toBeTruthy();

    await expect(page.getByTestId("item-prices-history-sort-amount")).toBeVisible();
    await expect(page.getByTestId("item-prices-history-filter-priceType")).toBeVisible();

    const resizeHandles = scroll.locator(".cursor-col-resize");
    await expect(resizeHandles.first()).toBeVisible();

    const desktopShot = testInfo.outputPath("prices-history-layout-desktop.png");
    await page.screenshot({ path: desktopShot, fullPage: false });
    await testInfo.attach("prices-history-desktop", { path: desktopShot, contentType: "image/png" });

    await page.setViewportSize({ width: 480, height: 720 });
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    await expect(page.getByTestId("item-prices-history-table")).toBeVisible({ timeout: 30_000 });
    const narrowScroll = page.locator("[data-item-prices-history-scroll]");
    const narrowMetrics = await narrowScroll.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(narrowMetrics.scrollWidth).toBeGreaterThan(narrowMetrics.clientWidth);

    const narrowShot = testInfo.outputPath("prices-history-layout-narrow.png");
    await page.screenshot({ path: narrowShot, fullPage: false });
    await testInfo.attach("prices-history-narrow", { path: narrowShot, contentType: "image/png" });

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("13.6 price history: sorting, filters, column sizing persist in localStorage after reload", async ({
    page,
  }) => {
    await openApp(page);
    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);

    await page.getByTestId("item-prices-history-sort-amount").click();

    await page.getByTestId("item-prices-history-filter-priceType").click();
    const panel = page.locator('[data-slot="popover-content"]').last();
    await panel.locator("select").nth(1).selectOption("purchase");
    await panel.getByRole("button", { name: /apply|применить|қолдану/i }).click();

    const scroll = page.locator("[data-item-prices-history-scroll]");
    const resizeHandle = scroll.locator(".cursor-col-resize").nth(1);
    const box = await resizeHandle.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 24, box!.y + box!.height / 2);
    await page.mouse.up();

    const before = await page.evaluate(() => ({
      sort: window.localStorage.getItem("mini-erp:item-prices-history:sorting:v1"),
      filters: window.localStorage.getItem("mini-erp:item-prices-history:filters:v1"),
      sizing: window.localStorage.getItem("mini-erp:item-prices-history:columnSizing:v1"),
    }));
    expect(before.sort).toBeTruthy();
    expect(before.sort).toContain("amount");
    expect(before.filters).toBeTruthy();
    expect(before.filters).toContain("purchase");
    expect(before.sizing).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);

    const after = await page.evaluate(() => ({
      sort: window.localStorage.getItem("mini-erp:item-prices-history:sorting:v1"),
      filters: window.localStorage.getItem("mini-erp:item-prices-history:filters:v1"),
      sizing: window.localStorage.getItem("mini-erp:item-prices-history:columnSizing:v1"),
    }));
    expect(after.sort).toBe(before.sort);
    expect(after.filters).toBe(before.filters);
    expect(after.sizing).toBe(before.sizing);

    await expect(page.getByTestId("item-prices-history-filter-priceType")).toHaveClass(/text-primary/);
  });

  test("14.1 current purchase/sale cards: sparkline + delta; next cards without trend UI; survives reload", async ({
    page,
  }) => {
    await openApp(page);
    const code = `E2E-TR-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Trend ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();

    const todayYmd = new Date().toISOString().slice(0, 10);

    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("10.00");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("12.50");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("correction");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    const purchaseCurrent = page.getByTestId("item-prices-card-purchase-current");
    await expect(purchaseCurrent.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible();
    await expect(purchaseCurrent.locator('[data-testid="item-price-delta"]')).toBeVisible();
    await expect(purchaseCurrent.locator('[data-testid="item-price-delta"]')).toHaveAttribute("data-delta-direction", "up");

    const purchaseValueRow = purchaseCurrent.getByTestId("item-price-summary-value-row");
    const purchaseDateRow = purchaseCurrent.getByTestId("item-price-summary-date-row");
    const purchaseReasonRow = purchaseCurrent.getByTestId("item-price-summary-reason-row");
    await expect(purchaseValueRow.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible();
    const purchaseChartArea = purchaseCurrent.getByTestId("item-price-trend-chart-area");
    await expect(purchaseChartArea).toBeVisible();
    const purchaseChartBox = await purchaseChartArea.boundingBox();
    expect(purchaseChartBox).toBeTruthy();
    expect(purchaseChartBox!.height).toBeGreaterThanOrEqual(52);
    expect(purchaseChartBox!.width).toBeGreaterThanOrEqual(168);
    await expect(purchaseDateRow.locator('[data-testid="item-price-delta"]')).toBeVisible();
    await expect(purchaseReasonRow.locator('[data-testid="item-price-delta-hint"]')).toBeVisible();
    const purchaseValueGeom = await purchaseValueRow.evaluate((row) => {
      const priceEl = row.children[0];
      const spark = row.querySelector('[data-testid="item-price-trend-sparkline"]');
      if (!priceEl || !spark) return null;
      return {
        priceRight: priceEl.getBoundingClientRect().right,
        sparkLeft: spark.getBoundingClientRect().left,
      };
    });
    expect(purchaseValueGeom).toBeTruthy();
    expect(purchaseValueGeom!.sparkLeft).toBeGreaterThanOrEqual(purchaseValueGeom!.priceRight - 1);
    const purchaseDateGeom = await purchaseDateRow.evaluate((row) => {
      const dateEl = row.children[0];
      const delta = row.querySelector('[data-testid="item-price-delta"]');
      if (!dateEl || !delta) return null;
      return {
        dateRight: dateEl.getBoundingClientRect().right,
        deltaLeft: delta.getBoundingClientRect().left,
      };
    });
    expect(purchaseDateGeom).toBeTruthy();
    expect(purchaseDateGeom!.deltaLeft).toBeGreaterThanOrEqual(purchaseDateGeom!.dateRight - 1);
    const purchaseReasonGeom = await purchaseReasonRow.evaluate((row) => {
      const reasonEl = row.children[0];
      const hint = row.querySelector('[data-testid="item-price-delta-hint"]');
      if (!reasonEl || !hint) return null;
      return {
        reasonRight: reasonEl.getBoundingClientRect().right,
        hintLeft: hint.getBoundingClientRect().left,
      };
    });
    expect(purchaseReasonGeom).toBeTruthy();
    expect(purchaseReasonGeom!.hintLeft).toBeGreaterThanOrEqual(purchaseReasonGeom!.reasonRight - 1);

    await page.getByTestId("item-prices-add-sale").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("20.00");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await page.getByTestId("item-prices-add-sale").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("15.00");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("correction");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    const saleCurrent = page.getByTestId("item-prices-card-sale-current");
    await expect(saleCurrent.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible();
    await expect(saleCurrent.locator('[data-testid="item-price-delta"]')).toHaveAttribute("data-delta-direction", "down");

    const saleValueRow = saleCurrent.getByTestId("item-price-summary-value-row");
    const saleDateRow = saleCurrent.getByTestId("item-price-summary-date-row");
    const saleReasonRow = saleCurrent.getByTestId("item-price-summary-reason-row");
    await expect(saleValueRow.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible();
    const saleChartArea = saleCurrent.getByTestId("item-price-trend-chart-area");
    await expect(saleChartArea).toBeVisible();
    const saleChartBox = await saleChartArea.boundingBox();
    expect(saleChartBox).toBeTruthy();
    expect(saleChartBox!.height).toBeGreaterThanOrEqual(52);
    expect(saleChartBox!.width).toBeGreaterThanOrEqual(168);
    await expect(saleDateRow.locator('[data-testid="item-price-delta"]')).toBeVisible();
    await expect(saleReasonRow.locator('[data-testid="item-price-delta-hint"]')).toBeVisible();
    const saleValueGeom = await saleValueRow.evaluate((row) => {
      const priceEl = row.children[0];
      const spark = row.querySelector('[data-testid="item-price-trend-sparkline"]');
      if (!priceEl || !spark) return null;
      return {
        priceRight: priceEl.getBoundingClientRect().right,
        sparkLeft: spark.getBoundingClientRect().left,
      };
    });
    expect(saleValueGeom).toBeTruthy();
    expect(saleValueGeom!.sparkLeft).toBeGreaterThanOrEqual(saleValueGeom!.priceRight - 1);
    const saleDateGeom = await saleDateRow.evaluate((row) => {
      const dateEl = row.children[0];
      const delta = row.querySelector('[data-testid="item-price-delta"]');
      if (!dateEl || !delta) return null;
      return {
        dateRight: dateEl.getBoundingClientRect().right,
        deltaLeft: delta.getBoundingClientRect().left,
      };
    });
    expect(saleDateGeom).toBeTruthy();
    expect(saleDateGeom!.deltaLeft).toBeGreaterThanOrEqual(saleDateGeom!.dateRight - 1);
    const saleReasonGeom = await saleReasonRow.evaluate((row) => {
      const reasonEl = row.children[0];
      const hint = row.querySelector('[data-testid="item-price-delta-hint"]');
      if (!reasonEl || !hint) return null;
      return {
        reasonRight: reasonEl.getBoundingClientRect().right,
        hintLeft: hint.getBoundingClientRect().left,
      };
    });
    expect(saleReasonGeom).toBeTruthy();
    expect(saleReasonGeom!.hintLeft).toBeGreaterThanOrEqual(saleReasonGeom!.reasonRight - 1);

    await expect(page.getByTestId("item-prices-card-purchase-next").locator('[data-testid="item-price-trend-sparkline"]')).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-purchase-next").getByTestId("item-price-trend-chart-area")).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-purchase-next").locator('[data-testid="item-price-delta"]')).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-purchase-next").locator('[data-testid="item-price-delta-hint"]')).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-sale-next").locator('[data-testid="item-price-trend-sparkline"]')).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-sale-next").getByTestId("item-price-trend-chart-area")).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-sale-next").locator('[data-testid="item-price-delta"]')).toHaveCount(0);
    await expect(page.getByTestId("item-prices-card-sale-next").locator('[data-testid="item-price-delta-hint"]')).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expect(purchaseCurrent.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible({ timeout: 15_000 });
    await expect(saleCurrent.locator('[data-testid="item-price-trend-sparkline"]')).toBeVisible({ timeout: 15_000 });
  });

  test("14.1b current price cards: chart area width stable when amount length changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    const code = `E2E-LAYOUT-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Layout ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();

    const todayYmd = new Date().toISOString().slice(0, 10);

    const addPurchase = async (amount: string, reason: string) => {
      await page.getByTestId("item-prices-add-purchase").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("item-price-amount-input").fill(amount);
      await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
      await page.getByTestId("item-price-reason-select").selectOption(reason);
      await page.getByTestId("item-price-dialog-submit").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });
    };

    const addSale = async (amount: string, reason: string) => {
      await page.getByTestId("item-prices-add-sale").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("item-price-amount-input").fill(amount);
      await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
      await page.getByTestId("item-price-reason-select").selectOption(reason);
      await page.getByTestId("item-price-dialog-submit").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });
    };

    await addPurchase("1.00", "manual_update");
    await addPurchase("2.00", "correction");

    const purchaseCard = page.getByTestId("item-prices-card-purchase-current");
    const purchaseChart = purchaseCard.getByTestId("item-price-trend-chart-area");
    await expect(purchaseChart).toBeVisible();
    const wPurchaseShort = (await purchaseChart.boundingBox())!.width;
    expect(wPurchaseShort).toBeGreaterThanOrEqual(168);

    await addPurchase("10000000.00", "correction");
    const wPurchaseLong = (await purchaseChart.boundingBox())!.width;
    expect(Math.abs(wPurchaseLong - wPurchaseShort)).toBeLessThanOrEqual(2);

    await addSale("50.00", "manual_update");
    await addSale("40.00", "correction");

    const saleCard = page.getByTestId("item-prices-card-sale-current");
    const saleChart = saleCard.getByTestId("item-price-trend-chart-area");
    await expect(saleChart).toBeVisible();
    const wSaleShort = (await saleChart.boundingBox())!.width;
    expect(wSaleShort).toBeGreaterThanOrEqual(168);

    await addSale("9999999.99", "correction");
    const wSaleLong = (await saleChart.boundingBox())!.width;
    expect(Math.abs(wSaleLong - wSaleShort)).toBeLessThanOrEqual(2);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expect(purchaseChart).toBeVisible({ timeout: 15_000 });
    const wPurchaseReload = (await purchaseChart.boundingBox())!.width;
    expect(Math.abs(wPurchaseReload - wPurchaseLong)).toBeLessThanOrEqual(2);
  });

  test("14.2 current card delta neutral when price unchanged vs previous active", async ({ page }) => {
    await openApp(page);
    const code = `E2E-TRN-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Trend neutral ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    const todayYmd = new Date().toISOString().slice(0, 10);

    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("7.00");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("manual_update");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await page.getByTestId("item-prices-add-purchase").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-price-amount-input").fill("7.00");
    await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
    await page.getByTestId("item-price-reason-select").selectOption("correction");
    await page.getByTestId("item-price-dialog-submit").click();
    await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await expect(
      page.getByTestId("item-prices-card-purchase-current").locator('[data-testid="item-price-delta"]'),
    ).toHaveAttribute("data-delta-direction", "same");
  });

  test("14.3 same-day multiple edits: delta/sparkline chain matches history table; survives reload", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    const code = `E2E-SD-${Date.now()}`;
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await page.locator("#item-name").fill(`Same-day ${code}`);
    await page.locator("#item-code").fill(code);
    await page.locator("#item-uom").fill("EA");
    await page.getByRole("button", { name: /^Save|Сохранить|Сақтау/i }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 20_000 });
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();

    const todayYmd = new Date().toISOString().slice(0, 10);

    for (const [amount, reason] of [
      ["100.00", "manual_update"],
      ["110.00", "correction"],
    ] as const) {
      await page.getByTestId("item-prices-add-purchase").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("item-price-amount-input").fill(amount);
      await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
      await page.getByTestId("item-price-reason-select").selectOption(reason);
      await page.getByTestId("item-price-dialog-submit").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });
    }

    for (const [amount, reason] of [
      ["50.00", "manual_update"],
      ["40.00", "commercial_review"],
    ] as const) {
      await page.getByTestId("item-prices-add-sale").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("item-price-amount-input").fill(amount);
      await page.getByTestId("item-price-valid-from-input").fill(todayYmd);
      await page.getByTestId("item-price-reason-select").selectOption(reason);
      await page.getByTestId("item-price-dialog-submit").click();
      await expect(page.getByTestId("item-price-edit-dialog")).toBeHidden({ timeout: 15_000 });
    }

    const purchaseCard = page.getByTestId("item-prices-card-purchase-current");
    const saleCard = page.getByTestId("item-prices-card-sale-current");

    await expect(purchaseCard.locator('[data-testid="item-price-delta"]')).toHaveAttribute("data-delta-direction", "up");
    await expect(purchaseCard.locator('[data-testid="item-price-trend-sparkline"]')).toHaveAttribute(
      "data-sparkline-values",
      "100,110",
    );

    await expect(saleCard.locator('[data-testid="item-price-delta"]')).toHaveAttribute("data-delta-direction", "down");
    await expect(saleCard.locator('[data-testid="item-price-trend-sparkline"]')).toHaveAttribute(
      "data-sparkline-values",
      "50,40",
    );

    await expandItemPriceHistorySection(page);
    const rows = page.getByTestId("item-prices-history-row");
    await expect(rows).toHaveCount(4, { timeout: 15_000 });
    await expect(rows.nth(0)).toContainText(/sale/i);
    await expect(rows.nth(0)).toContainText(/40/);
    await expect(rows.nth(1)).toContainText(/sale/i);
    await expect(rows.nth(1)).toContainText(/50/);
    await expect(rows.nth(2)).toContainText(/purchase/i);
    await expect(rows.nth(2)).toContainText(/110/);
    await expect(rows.nth(3)).toContainText(/purchase/i);
    await expect(rows.nth(3)).toContainText(/100/);

    await expect(page.getByTestId("item-prices-card-purchase-next").locator('[data-testid="item-price-trend-sparkline"]')).toHaveCount(
      0,
    );
    await expect(page.getByTestId("item-prices-card-sale-next").locator('[data-testid="item-price-trend-sparkline"]')).toHaveCount(
      0,
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expect(purchaseCard.locator('[data-testid="item-price-trend-sparkline"]')).toHaveAttribute(
      "data-sparkline-values",
      "100,110",
      { timeout: 15_000 },
    );
    await expect(saleCard.locator('[data-testid="item-price-trend-sparkline"]')).toHaveAttribute("data-sparkline-values", "50,40");

    const sameDayShot = testInfo.outputPath("item-prices-same-day-multichange.png");
    await page.screenshot({ path: sameDayShot, fullPage: true });
    await testInfo.attach("item-prices-same-day-multichange", { path: sameDayShot, contentType: "image/png" });
  });

  test("13.5 price history: compare typography with Items list table (screenshot)", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await openApp(page);
    await gotoReady(page, "/items");
    await page.locator(".list-page__content").waitFor({ state: "visible", timeout: 60_000 });
    const itemsShot = testInfo.outputPath("items-list-table-reference.png");
    await page.screenshot({ path: itemsShot, fullPage: false });
    await testInfo.attach("items-list-reference", { path: itemsShot, contentType: "image/png" });

    const itemId = await firstItemId(page);
    await gotoReady(page, `/items/${encodeURIComponent(itemId)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-prices").click();
    await expandItemPriceHistorySection(page);
    const pricesShot = testInfo.outputPath("item-prices-history-table.png");
    await page.screenshot({ path: pricesShot, fullPage: false });
    await testInfo.attach("item-prices-history", { path: pricesShot, contentType: "image/png" });
  });
});
