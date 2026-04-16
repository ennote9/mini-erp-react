import { test, expect } from "@playwright/test";

const BARCODES_URL = process.env.PLAYWRIGHT_BARCODES_URL ?? "http://localhost:1420/barcodes";

test.describe("Barcode Registry list (TanStack)", () => {
  test("renders search, table scroll host, and view settings", async ({ page }) => {
    await page.goto(BARCODES_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-barcode-registry-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__toolbar-actions-cluster button[data-icon='inline-start']")).toBeVisible();
  });
});
