import { test, expect } from "@playwright/test";

const CARRIERS_URL = process.env.PLAYWRIGHT_CARRIERS_URL ?? "http://localhost:1420/carriers";

test.describe("Carriers list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(CARRIERS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-carriers-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
