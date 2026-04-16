import { test, expect } from "@playwright/test";

const WAREHOUSES_URL = process.env.PLAYWRIGHT_WAREHOUSES_URL ?? "http://localhost:1420/warehouses";

test.describe("Warehouses list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(WAREHOUSES_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-warehouses-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
