import { test, expect } from "@playwright/test";

const CUSTOMERS_URL = process.env.PLAYWRIGHT_CUSTOMERS_URL ?? "http://localhost:1420/customers";

test.describe("Customers list (TanStack)", () => {
  test("renders search, table scroll host, and create control", async ({ page }) => {
    await page.goto(CUSTOMERS_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-customers-table-scroll]")).toBeVisible();
    await expect(page.locator(".list-page__create-btn")).toBeVisible();
  });
});
