import { test, expect } from "@playwright/test";

const MARKDOWN_JOURNAL_URL =
  process.env.PLAYWRIGHT_MARKDOWN_JOURNAL_URL ?? "http://localhost:1420/markdown-journal";

test.describe("Markdown journal list (TanStack)", () => {
  test("renders search, table scroll host, and view settings", async ({ page }) => {
    await page.goto(MARKDOWN_JOURNAL_URL);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator("[data-markdown-journal-table-scroll]")).toBeVisible();
    await expect(page.locator("button[data-icon='inline-start']")).toBeVisible();
  });
});
