import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:1420";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type E2eApi = any;

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

async function waitEmployeesHydrated(page: Page) {
  await page.waitForFunction(
    () => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      try {
        return Boolean(w && w.employeeRepository.list().length > 0);
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
  await waitEmployeesHydrated(page);
}

async function openApp(page: Page) {
  await gotoReady(page, "/");
}

async function itemIdByCode(page: Page, code: string): Promise<string | undefined> {
  return page.evaluate((c) => {
    const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
    const row = w.itemRepository.list().find((x: { code: string }) => x.code === c);
    return row?.id as string | undefined;
  }, code);
}

async function waitItemTabsVisible(page: Page) {
  await page.getByTestId("item-tab-main").waitFor({ state: "visible", timeout: 60_000 });
}

async function waitNewItemFormVisible(page: Page) {
  await page.locator("#item-name").waitFor({ state: "visible", timeout: 60_000 });
}

test.describe("Item card — Responsibles tab (acceptance)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("10.1 Responsibles tab: direct table only, no summary or related blocks", async ({ page }) => {
    await openApp(page);
    const itemId = await itemIdByCode(page, "ITEM-001");
    test.skip(!itemId, "Seed item ITEM-001 not found");
    await gotoReady(page, `/items/${encodeURIComponent(itemId!)}`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-responsibles").click();
    await expect(page.getByTestId("item-responsibles-direct")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="item-responsibles-summary"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="item-responsibles-brand"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="item-responsibles-category"]')).toHaveCount(0);
    await expect(page.getByTestId("item-responsibles-direct").locator("table")).toBeVisible();
  });

  test("10.2–10.4 direct assignments: add, replace, remove (same session)", async ({ page }) => {
    await openApp(page);
    const itemId = await itemIdByCode(page, "ITEM-001");
    test.skip(!itemId, "Seed item ITEM-001 not found");

    await page.evaluate(async (id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: { patchItem: (a: string, b: unknown) => Promise<void> } })
        .__MINI_ERP_E2E__;
      await w!.patchItem(id, { responsibleAssignments: [] });
    }, itemId!);

    await gotoReady(page, `/items/${encodeURIComponent(itemId!)}?tab=responsibles`);
    await waitItemTabsVisible(page);
    await expect(page.locator('[data-testid="item-responsible-assign-content_manager"]')).toHaveCount(0);
    await expect(page.getByTestId("item-responsible-menu-content_manager")).toBeVisible();

    await page.getByTestId("item-responsible-menu-content_manager").click();
    await expect(page.getByTestId("item-responsible-menu-assign-content_manager")).toBeVisible();
    await page.getByTestId("item-responsible-menu-assign-content_manager").click();
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-responsible-dialog-employee").selectOption("2");
    await page.getByTestId("item-responsible-dialog-submit").click();
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeHidden({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitItemsRepositoryHydrated(page);
    await waitEmployeesHydrated(page);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-tab-responsibles").click();
    await expect(page.getByTestId("item-responsibles-direct")).toContainText(/R\. Chen|Robert Chen/i);

    let persisted = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const it = w.itemRepository.getById(id);
      return it?.responsibleAssignments?.find((a: { roleCode: string }) => a.roleCode === "content_manager");
    }, itemId!);
    expect(persisted?.employeeId).toBe("2");

    await expect(page.getByTestId("item-responsible-menu-content_manager")).toBeVisible();
    await expect(page.locator('[data-testid="item-responsible-replace-content_manager"]')).toHaveCount(0);
    await page.getByTestId("item-responsible-menu-content_manager").click();
    await expect(page.getByTestId("item-responsible-menu-replace-content_manager")).toBeVisible();
    await expect(page.getByTestId("item-responsible-menu-remove-content_manager")).toBeVisible();
    await page.getByTestId("item-responsible-menu-replace-content_manager").click();
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-responsible-dialog-employee").selectOption("1");
    await page.getByTestId("item-responsible-dialog-submit").click();
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeHidden({ timeout: 15_000 });

    let assignments = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const it = w.itemRepository.getById(id);
      return (it?.responsibleAssignments ?? []).filter((a: { roleCode: string }) => a.roleCode === "content_manager");
    }, itemId!);
    expect(assignments.length).toBe(1);
    expect(assignments[0].employeeId).toBe("1");

    await page.getByTestId("item-responsible-menu-content_manager").click();
    await page.getByTestId("item-responsible-menu-remove-content_manager").click();
    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
          const it = w.itemRepository.getById(id);
          return (it?.responsibleAssignments ?? []).filter((a: { roleCode: string }) => a.roleCode === "content_manager")
            .length;
        }, itemId!),
      )
      .toBe(0);

    assignments = await page.evaluate((id) => {
      const w = (window as Window & { __MINI_ERP_E2E__?: E2eApi }).__MINI_ERP_E2E__;
      const it = w.itemRepository.getById(id);
      return (it?.responsibleAssignments ?? []).filter((a: { roleCode: string }) => a.roleCode === "content_manager");
    }, itemId!);
    expect(assignments.length).toBe(0);
    await expect(page.locator('[data-testid="item-responsible-assign-content_manager"]')).toHaveCount(0);
    await expect(page.getByTestId("item-responsible-menu-content_manager")).toBeVisible();
    await page.getByTestId("item-responsible-menu-content_manager").click();
    await expect(page.getByTestId("item-responsible-menu-assign-content_manager")).toBeVisible();
    await expect(page.getByTestId("item-responsible-menu-replace-content_manager")).toHaveCount(0);
  });

  test("10.5 unsaved item: responsibles blocked until save", async ({ page }) => {
    await openApp(page);
    await gotoReady(page, "/items/new");
    await waitNewItemFormVisible(page);
    await expect(page.getByTestId("item-tab-responsibles")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("item-tab-responsibles").click();
    await expect(page.getByTestId("item-responsibles-unsaved-hint")).toBeVisible({ timeout: 30_000 });
  });

  test("10.6 modal: employee hint panel when selecting scoped employee (ITEM-001 + emp 4)", async ({
    page,
  }) => {
    await openApp(page);
    const itemId = await itemIdByCode(page, "ITEM-001");
    test.skip(!itemId, "Seed item ITEM-001 not found");
    await gotoReady(page, `/items/${encodeURIComponent(itemId!)}?tab=responsibles`);
    await waitItemTabsVisible(page);
    await page.getByTestId("item-responsible-menu-buyer").click();
    await page.getByTestId("item-responsible-menu-assign-buyer").click();
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("item-responsible-dialog-employee").selectOption("4");
    await expect(page.getByTestId("item-responsible-dialog-employee-hint")).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("item-responsible-edit-dialog")).toBeHidden({ timeout: 5_000 });
  });

  test("10.7 regression: main / prices / responsibles / images / barcodes / testers", async ({ page }) => {
    await openApp(page);
    const itemId = await itemIdByCode(page, "ITEM-001");
    test.skip(!itemId, "Seed item ITEM-001 not found");
    await gotoReady(page, `/items/${encodeURIComponent(itemId!)}`);
    await waitItemTabsVisible(page);

    await page.getByTestId("item-tab-main").click();
    await expect(page.locator("#item-name")).toBeVisible();

    await page.getByTestId("item-tab-prices").click();
    await expect(page.getByTestId("item-prices-summary-grid")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("item-tab-responsibles").click();
    await expect(page.getByTestId("item-responsibles-direct")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("item-tab-images").click();
    await expect(page.getByText(/upload|загруз|жүктеу/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("item-tab-barcodes").click();
    await expect(page.getByText(/barcode|штрих/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("item-tab-testers").click();
    await expect(page.getByText(/tester|тестер/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
