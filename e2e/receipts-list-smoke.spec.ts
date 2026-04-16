import { test, expect } from "@playwright/test";

const RECEIPTS_URL = process.env.PLAYWRIGHT_RECEIPTS_URL ?? "http://localhost:1420/receipts";

test.describe("Receipts list (TanStack)", () => {
  test("renders search, table scroll host, view settings, and create", async ({ page }) => {
    await page.goto(RECEIPTS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-receipts-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
