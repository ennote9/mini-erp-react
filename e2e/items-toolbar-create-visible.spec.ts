import { test, expect, type Page, type Locator } from "@playwright/test";

/** Real app only — no preview substitute for acceptance. */
const ITEMS_URL =
  process.env.PLAYWRIGHT_ITEMS_URL ?? "http://localhost:1420/items";

type CreateButtonAudit = {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  horizontalInternalOverflow: boolean;
  verticalInternalOverflow: boolean;
  innerTextTrimmed: string;
  /** Non-whitespace text ranges inside the button (label + any other text). */
  textFragments: Array<{
    text: string;
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    fullyInsideButton: boolean;
  }>;
  /** True if there is a readable label fragment (not icon-only / clipped text). */
  hasReadableLabelFragment: boolean;
  outer: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  innerWidth: number;
  outerInViewport: boolean;
};

async function enableAllColumnsViaModal(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator("[data-items-table-scroll] tbody tr")
    .first()
    .waitFor({ state: "visible", timeout: 45_000 })
    .catch(() => {});

  const cluster = page.locator(".list-page__toolbar-actions-cluster");
  await expect(cluster, "Toolbar actions cluster").toBeVisible({ timeout: 20_000 });

  /** i18n `doc.list.viewSettings`: en "View", ru "Вид", kk "Көрініс" */
  const viewBtn = cluster.getByRole("button", { name: /^(View|Вид|Көрініс)$/ });
  await expect(viewBtn, "View / column settings (toolbar)").toBeVisible({ timeout: 25_000 });
  await viewBtn.click();

  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, "Column settings dialog").toBeVisible({ timeout: 15_000 });

  /** Field visibility uses Radix `Switch` → `role="switch"`, not `<input type="checkbox">`. */
  const switches = dialog.locator('[role="switch"]');
  const n = await switches.count();
  expect(n, "At least one column visibility switch").toBeGreaterThan(0);

  for (let i = 0; i < n; i++) {
    const sw = switches.nth(i);
    if (!(await sw.isVisible().catch(() => false))) continue;
    if (await sw.isDisabled().catch(() => true)) continue;
    const checked = await sw.getAttribute("data-state");
    if (checked !== "checked") await sw.click({ force: true });
  }

  const apply = dialog.getByRole("button", { name: /apply|применить/i });
  await expect(apply, "Apply column settings").toBeVisible();
  await apply.click();

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function auditCreateButton(locator: Locator): Promise<CreateButtonAudit> {
  return locator.evaluate((el: HTMLElement) => {
    const innerWidth = window.innerWidth;
    const br = el.getBoundingClientRect();
    const outerInViewport =
      br.left >= -1 && br.right <= innerWidth + 1 && br.top >= -1 && br.bottom <= window.innerHeight + 1;

    const horizontalInternalOverflow = el.scrollWidth > el.clientWidth + 1;
    const verticalInternalOverflow = el.scrollHeight > el.clientHeight + 1;

    const innerTextTrimmed = el.innerText.replace(/\s+/g, " ").trim();

    const range = document.createRange();
    const textFragments: CreateButtonAudit["textFragments"] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const raw = node.textContent ?? "";
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text) {
        node = walker.nextNode();
        continue;
      }
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      const fullyInsideButton =
        r.width > 0.5 &&
        r.height > 0.5 &&
        r.left >= br.left - 1 &&
        r.right <= br.right + 1 &&
        r.top >= br.top - 1 &&
        r.bottom <= br.bottom + 1;
      textFragments.push({
        text,
        width: r.width,
        height: r.height,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        fullyInsideButton,
      });
      node = walker.nextNode();
    }

    const labelLike = textFragments.filter((f) => f.width >= 14 && f.height >= 8);
    const hasReadableLabelFragment = labelLike.some((f) => f.fullyInsideButton);

    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      horizontalInternalOverflow,
      verticalInternalOverflow,
      innerTextTrimmed,
      textFragments,
      hasReadableLabelFragment,
      outer: {
        left: br.left,
        right: br.right,
        top: br.top,
        bottom: br.bottom,
        width: br.width,
        height: br.height,
      },
      innerWidth,
      outerInViewport,
    };
  });
}

async function assertCreateButtonUsable(
  create: Locator,
  viewportLabel: string,
  testInfo: import("@playwright/test").TestInfo,
) {
  const audit = await auditCreateButton(create);
  await testInfo.attach(`${viewportLabel}-create-audit.json`, {
    body: JSON.stringify(audit, null, 2),
    contentType: "application/json",
  });

  expect(
    audit.outerInViewport,
    `${viewportLabel}: Create outer box must sit inside viewport (left=${audit.outer.left}, right=${audit.outer.right}, innerWidth=${audit.innerWidth})`,
  ).toBe(true);

  expect(
    audit.horizontalInternalOverflow,
    `${viewportLabel}: Create must not clip content horizontally (scrollWidth ${audit.scrollWidth} vs clientWidth ${audit.clientWidth})`,
  ).toBe(false);

  expect(
    audit.verticalInternalOverflow,
    `${viewportLabel}: Create must not clip content vertically (scrollHeight ${audit.scrollHeight} vs clientHeight ${audit.clientHeight})`,
  ).toBe(false);

  expect(
    audit.innerTextTrimmed.length,
    `${viewportLabel}: Create should expose non-empty visible label text (innerText), got "${audit.innerTextTrimmed}"`,
  ).toBeGreaterThanOrEqual(3);

  expect(
    audit.hasReadableLabelFragment,
    `${viewportLabel}: Create needs a readable text fragment (width≥14, height≥8) fully inside the button — fragments=${JSON.stringify(audit.textFragments)}`,
  ).toBe(true);

  expect(
    audit.outer.width,
    `${viewportLabel}: Create width collapsed too far (${audit.outer.width}px); expect a real text button, not icon-only`,
  ).toBeGreaterThanOrEqual(52);
}

test.describe("Items /items toolbar — Create not clipped", () => {
  test("Create: viewport + internal layout (no label clip / collapse)", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 560, height: 900 });
    const response = await page.goto(ITEMS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    expect(
      response?.ok(),
      `GET ${ITEMS_URL} must return 2xx (start \`npm run tauri dev\` or \`npm run dev\` on port 1420 first). Got: ${response?.status()}`,
    ).toBeTruthy();

    const create = page.locator(".list-page__controls .list-page__create-btn").first();
    await create.waitFor({ state: "visible", timeout: 45_000 });

    await enableAllColumnsViaModal(page);

    const widths = [480, 420, 380, 340, 300, 280];
    for (const width of widths) {
      const label = `w${width}`;
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);

      await assertCreateButtonUsable(create, label, testInfo);

      await page.screenshot({
        path: testInfo.outputPath(`toolbar-${label}.png`),
        fullPage: false,
      });
    }
  });
});
