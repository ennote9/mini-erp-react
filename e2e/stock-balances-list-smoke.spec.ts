import { test, expect } from "@playwright/test";

const STOCK_BALANCES_URL =
  process.env.PLAYWRIGHT_STOCK_BALANCES_URL ?? "http://localhost:1420/stock-balances";

test.describe("Stock balances list (TanStack)", () => {
  test("renders search, table scroll host, and view settings", async ({ page }) => {
    await page.goto(STOCK_BALANCES_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-stock-balances-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
  });
});
