import { test, expect } from "@playwright/test";

const STOCK_MOVEMENTS_URL =
  process.env.PLAYWRIGHT_STOCK_MOVEMENTS_URL ?? "http://localhost:1420/stock-movements";

test.describe("Stock movements list (TanStack)", () => {
  test("renders search, table scroll host, and view settings", async ({ page }) => {
    await page.goto(STOCK_MOVEMENTS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-stock-movements-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
  });
});
