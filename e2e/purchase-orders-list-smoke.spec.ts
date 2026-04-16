import { test, expect } from "@playwright/test";

const PURCHASE_ORDERS_URL =
  process.env.PLAYWRIGHT_PURCHASE_ORDERS_URL ?? "http://localhost:1420/purchase-orders";

test.describe("Purchase orders list (TanStack)", () => {
  test("renders search, table scroll host, view settings, and create", async ({ page }) => {
    await page.goto(PURCHASE_ORDERS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-purchase-orders-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
