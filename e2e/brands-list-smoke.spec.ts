import { test, expect } from "@playwright/test";

const BRANDS_URL = process.env.PLAYWRIGHT_BRANDS_URL ?? "http://localhost:1420/brands";

test.describe("Brands list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(BRANDS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-brands-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
