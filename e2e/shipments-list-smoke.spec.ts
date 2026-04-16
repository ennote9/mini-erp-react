import { test, expect } from "@playwright/test";

const SHIPMENTS_URL = process.env.PLAYWRIGHT_SHIPMENTS_URL ?? "http://localhost:1420/shipments";

test.describe("Shipments list (TanStack)", () => {
  test("renders search, table scroll host, and view settings", async ({ page }) => {
    await page.goto(SHIPMENTS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-shipments-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
  });
});
