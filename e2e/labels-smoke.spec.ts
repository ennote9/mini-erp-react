import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:1420";

/** Dev-only browser API (`src/dev/e2eHarness.ts`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type E2eApi = any;

const TPL_ITEM = "label-tpl-sys-item";
const TPL_TRANSLATION = "label-tpl-sys-translation";

async function gotoOk(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  test.skip(!res?.ok(), `Dev app not reachable at ${url} (start npm run dev on 1420)`);
}

async function waitE2e(page: Page) {
  await page.waitForFunction(
    () => Boolean((window as Window & { __MINI_ERP_E2E__?: unknown }).__MINI_ERP_E2E__),
    undefined,
    { timeout: 60_000 },
  );
}

async function waitItemsRepositoryHydrated(page: Page) {
  await waitE2e(page);
  await page.waitForFunction(
    () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      try {
        return Boolean(w && w.itemRepository.list().length > 0);
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 60_000 },
  );
}

async function gotoReady(page: Page, pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${BASE.replace(/\/$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  await gotoOk(page, url);
  await waitItemsRepositoryHydrated(page);
}

async function firstItemId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
    const rows = w.itemRepository.list();
    if (rows.length === 0) throw new Error("No items in repository");
    return rows[0].id;
  });
}

async function patchItem(page: Page, id: string, patch: Record<string, unknown>) {
  await page.evaluate(
    async ({ itemId, p }) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      if (!w) throw new Error("E2E API missing");
      await w.patchItem(itemId, p);
      await w.flushAll();
    },
    { itemId: id, p: patch },
  );
}

/** Popover `SelectField` — opens listbox. */
async function pickSelectFieldOption(page: Page, triggerTestId: string, optionName: string | RegExp) {
  await page.getByTestId(triggerTestId).click();
  const listbox = page.locator("ul[role='listbox']").first();
  await listbox.waitFor({ state: "visible", timeout: 15_000 });
  await listbox.getByRole("option", { name: optionName }).first().click();
}

test.describe("Labels — workspace / station / batch (smoke)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("workspace: generic template — preview loads, actions enabled", async ({ page }) => {
    await gotoReady(page, "/labels/workspace");
    await expect(page.getByTestId("labels-workspace")).toBeVisible();
    await page.getByTestId("labels-workspace-template-select").click();
    const listbox = page.locator("ul[role='listbox']").first();
    await listbox.waitFor({ state: "visible", timeout: 15_000 });
    await listbox.getByRole("option").first().click();
    await expect(page.getByTestId("labels-workspace-create-job")).toBeEnabled();
    await expect(page.getByTestId("labels-workspace-save-pdf")).toBeEnabled();
    await expect(page.getByTestId("labels-workspace-print")).toBeEnabled();
    await expect(page.getByTestId("labels-domain-issues")).toHaveCount(0);
  });

  test("workspace: domain template without item data — blocked", async ({ page }) => {
    await gotoReady(page, "/");
    const id = await firstItemId(page);
    await patchItem(page, id, {
      translationName: undefined,
      translationDescription: undefined,
      translationComposition: undefined,
      translationExtraText: undefined,
    });
    await gotoReady(page, `/labels/workspace?itemId=${encodeURIComponent(id)}&templateId=${TPL_TRANSLATION}`);
    await expect(page.getByTestId("labels-domain-issues")).toBeVisible();
    await expect(page.getByTestId("labels-workspace-create-job")).toBeDisabled();
    await expect(page.getByTestId("labels-workspace-save-pdf")).toBeDisabled();
    await expect(page.getByTestId("labels-workspace-print")).toBeDisabled();
  });

  test("item label tab → workspace: domain block clears after save", async ({ page }) => {
    await gotoReady(page, "/");
    const id = await firstItemId(page);
    await patchItem(page, id, {
      translationName: undefined,
      translationDescription: undefined,
      translationComposition: undefined,
      translationExtraText: undefined,
    });
    await gotoReady(page, `/items/${encodeURIComponent(id)}`);
    await page.getByTestId("item-tab-labelData").click();
    await page.getByTestId("item-label-data-translation-name").fill("E2E translation line");
    await page.getByRole("button", { name: /^Save|^Сохранить/i }).click();
    await gotoReady(page, `/labels/workspace?itemId=${encodeURIComponent(id)}&templateId=${TPL_TRANSLATION}`);
    await expect(page.getByTestId("labels-domain-issues")).toHaveCount(0);
    await expect(page.getByTestId("labels-workspace-print")).toBeEnabled();
  });

  test("station: search field focused on open (operator flow)", async ({ page }) => {
    await gotoReady(page, "/labels/station");
    await expect(page.getByTestId("labels-station-search")).toBeFocused();
  });

  test("station: domain block then unblock after data", async ({ page }) => {
    await gotoReady(page, "/");
    const id = await firstItemId(page);
    await patchItem(page, id, {
      translationName: undefined,
      translationDescription: undefined,
      translationComposition: undefined,
      translationExtraText: undefined,
    });
    await gotoReady(page, `/labels/station?itemId=${encodeURIComponent(id)}&templateId=${TPL_TRANSLATION}`);
    await expect(page.getByTestId("labels-station")).toBeVisible();
    await expect(page.getByTestId("labels-domain-issues")).toBeVisible();
    await expect(page.getByTestId("labels-station-print")).toBeDisabled();
    await patchItem(page, id, { translationName: "Station OK" });
    await expect(page.getByTestId("labels-station-print")).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId("labels-domain-issues")).toHaveCount(0);
  });

  test("batch: invalid row and blocked actions, then valid", async ({ page }) => {
    await gotoReady(page, "/");
    const id = await firstItemId(page);
    const code = await page.evaluate(() => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return String(w.itemRepository.list()[0]?.code ?? "");
    });

    await patchItem(page, id, {
      translationName: undefined,
      translationDescription: undefined,
      translationComposition: undefined,
      translationExtraText: undefined,
    });

    await gotoReady(page, "/labels/batch");
    await expect(page.getByTestId("labels-batch")).toBeVisible();

    await page.getByTestId("labels-batch-search").fill(code);
    await page.getByRole("button", { name: /^Add|^Добавить/i }).click();

    await pickSelectFieldOption(page, "labels-batch-template-select", /Переводн|Translation sticker/i);

    await expect(page.getByTestId("labels-batch-domain-rows-hint")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("labels-batch-print")).toBeDisabled();

    await patchItem(page, id, { translationName: "Batch OK" });
    await expect(page.getByTestId("labels-batch-print")).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId("labels-batch-domain-rows-hint")).toHaveCount(0);
  });

  test("templates seeded for labels e2e", async ({ page }) => {
    await gotoReady(page, "/");
    const ids = await page.evaluate(() => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      return w.labelTemplateRepository.list().map((t: { id: string }) => t.id);
    });
    expect(ids).toEqual(expect.arrayContaining([TPL_ITEM, TPL_TRANSLATION]));
  });
});
