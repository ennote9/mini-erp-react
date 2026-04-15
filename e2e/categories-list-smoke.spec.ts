import { test, expect } from "@playwright/test";

const CATEGORIES_URL = process.env.PLAYWRIGHT_CATEGORIES_URL ?? "http://localhost:1420/categories";

test.describe("Categories list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(CATEGORIES_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-categories-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
