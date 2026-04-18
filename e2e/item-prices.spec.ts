import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:1420";

test.describe("Item card — Prices tab & main form", () => {
  test("new item: Prices tab shows save-first hint", async ({ page }) => {
    const res = await page.goto(`${BASE}/items/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    test.skip(!res?.ok(), `Dev app not reachable at ${BASE} (start npm run dev on 1420)`);

    await page.getByTestId("item-tab-prices").click();
    await expect(page.getByTestId("item-prices-unsaved-hint")).toBeVisible({ timeout: 15_000 });
  });

  test("existing item: has Prices tab and main tab has no legacy price fields", async ({ page }) => {
    const res = await page.goto(`${BASE}/items/1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    test.skip(!res?.ok(), `Dev app not reachable at ${BASE}`);

    await expect(page.getByTestId("item-tab-main")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("item-tab-prices")).toBeVisible();
    await expect(page.getByTestId("item-tab-images")).toBeVisible();
    await expect(page.getByTestId("item-tab-barcodes")).toBeVisible();

    await page.getByTestId("item-tab-main").click();
    await expect(page.locator("#item-purchasePrice")).toHaveCount(0);
    await expect(page.locator("#item-salePrice")).toHaveCount(0);
  });

  test("existing item: Prices tab shows summary and table headers", async ({ page }) => {
    const res = await page.goto(`${BASE}/items/1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    test.skip(!res?.ok(), `Dev app not reachable at ${BASE}`);

    await page.getByTestId("item-tab-prices").click();
    await expect(
      page.getByText(/base purchase and base sale|базовая закупочная|базалық сатып алу/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Add purchase|Добавить закупочную|Сатып алу бағасын қосу/i })).toBeVisible();
  });
});
