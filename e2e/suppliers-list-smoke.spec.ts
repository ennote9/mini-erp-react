import { test, expect } from "@playwright/test";

const SUPPLIERS_URL = process.env.PLAYWRIGHT_SUPPLIERS_URL ?? "http://localhost:1420/suppliers";

test.describe("Suppliers list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(SUPPLIERS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-suppliers-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
