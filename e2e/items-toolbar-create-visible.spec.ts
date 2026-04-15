import { test, expect, type Page, type Locator } from "@playwright/test";

/** Real app only — no preview substitute for acceptance. */
const ITEMS_URL =
  process.env.PLAYWRIGHT_ITEMS_URL ?? "http://localhost:1420/items";

/**
 * Items table schema defines ~19 logical columns (see `itemsTableSchema.ts`).
 * "Enable all" in the modal must surface most of them in the header row.
 */
const MIN_VISIBLE_HEADER_CELLS = Number(process.env.PLAYWRIGHT_MIN_VISIBLE_COLUMNS ?? "15");

const MIN_TABLE_OVERFLOW_PX = Number(process.env.PLAYWRIGHT_MIN_TABLE_OVERFLOW_PX ?? "40");

type BoxMetrics = {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  horizOverflow: boolean;
  vertOverflow: boolean;
  rect: { left: number; right: number; top: number; bottom: number; width: number; height: number };
};

type LayoutSnapshot = {
  innerWidth: number;
  innerHeight: number;
  visibleHeaderCellCount: number;
  tableHost: (BoxMetrics & { scrollOverflowPx: number }) | null;
  controls: BoxMetrics | null;
  actionCluster: BoxMetrics | null;
  create: BoxMetrics & {
    outer: BoxMetrics["rect"];
    fullyInsideActionCluster: boolean;
    fullyInsideControls: boolean;
    /** Intersection width of Create rect with action cluster visible rect (screen coords). */
    intersectClusterWidth: number;
  } | null;
};

type CreateButtonAudit = {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  horizontalInternalOverflow: boolean;
  verticalInternalOverflow: boolean;
  innerTextTrimmed: string;
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
  hasReadableLabelFragment: boolean;
  outer: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  innerWidth: number;
  outerInViewport: boolean;
};

async function collectLayoutSnapshot(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
    function metrics(el: HTMLElement | null): BoxMetrics | null {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        horizOverflow: el.scrollWidth > el.clientWidth + 1,
        vertOverflow: el.scrollHeight > el.clientHeight + 1,
        rect: {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        },
      };
    }

    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;

    const tableHost = document.querySelector("[data-items-table-scroll]") as HTMLElement | null;
    const headerRow = tableHost?.querySelector("thead tr");
    const visibleHeaderCellCount = headerRow ? headerRow.querySelectorAll("th").length : 0;

    const thm = metrics(tableHost);
    const tableHostMetrics = thm
      ? {
          ...thm,
          scrollOverflowPx: thm.scrollWidth - thm.clientWidth,
        }
      : null;

    const controls = document.querySelector(".list-page__controls") as HTMLElement | null;
    const actionCluster = document.querySelector(
      ".list-page__toolbar-actions-cluster",
    ) as HTMLElement | null;
    const createEl = document.querySelector(
      ".list-page__controls .list-page__create-btn",
    ) as HTMLElement | null;

    let create: LayoutSnapshot["create"] = null;
    if (createEl) {
      const cm = metrics(createEl);
      if (cm) {
        const cr = createEl.getBoundingClientRect();
        const kr = actionCluster?.getBoundingClientRect();
        const pr = controls?.getBoundingClientRect();

        const intersectWidth = (() => {
          if (!actionCluster || !kr) return 0;
          const left = Math.max(cr.left, kr.left);
          const right = Math.min(cr.right, kr.right);
          return Math.max(0, right - left);
        })();

        const fullyInsideActionCluster =
          !!actionCluster &&
          !!kr &&
          cr.left >= kr.left - 2 &&
          cr.right <= kr.right + 2 &&
          cr.top >= kr.top - 2 &&
          cr.bottom <= kr.bottom + 2;

        const fullyInsideControls =
          !!controls &&
          !!pr &&
          cr.left >= pr.left - 2 &&
          cr.right <= pr.right + 2 &&
          cr.top >= pr.top - 2 &&
          cr.bottom <= pr.bottom + 2;

        create = {
          ...cm,
          outer: cm.rect,
          fullyInsideActionCluster,
          fullyInsideControls,
          intersectClusterWidth: intersectWidth,
        };
      }
    }

    return {
      innerWidth,
      innerHeight,
      visibleHeaderCellCount,
      tableHost: tableHostMetrics,
      controls: metrics(controls),
      actionCluster: metrics(actionCluster),
      create,
    };
  });
}

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

  /** Field visibility uses Radix `Switch` → `role="switch"`. */
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
  await page.waitForTimeout(600);
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

async function assertLayoutStressAndToolbarHealth(
  layout: LayoutSnapshot,
  viewportLabel: string,
  testInfo: import("@playwright/test").TestInfo,
) {
  await testInfo.attach(`${viewportLabel}-layout-snapshot.json`, {
    body: JSON.stringify(layout, null, 2),
    contentType: "application/json",
  });

  expect(
    layout.visibleHeaderCellCount,
    `${viewportLabel}: Expected many visible columns after "enable all" (>=${MIN_VISIBLE_HEADER_CELLS}), got ${layout.visibleHeaderCellCount}`,
  ).toBeGreaterThanOrEqual(MIN_VISIBLE_HEADER_CELLS);

  expect(layout.tableHost, `${viewportLabel}: Table scroll host missing`).toBeTruthy();
  expect(
    layout.tableHost!.scrollOverflowPx,
    `${viewportLabel}: Table must be in horizontal overflow (wide grid stress). scrollWidth-clientWidth=${layout.tableHost!.scrollOverflowPx}`,
  ).toBeGreaterThanOrEqual(MIN_TABLE_OVERFLOW_PX);

  expect(layout.controls, `${viewportLabel}: .list-page__controls missing`).toBeTruthy();
  expect(
    layout.controls!.horizOverflow,
    `${viewportLabel}: Controls row must not overflow horizontally (scrollWidth ${layout.controls!.scrollWidth} vs clientWidth ${layout.controls!.clientWidth})`,
  ).toBe(false);

  expect(layout.actionCluster, `${viewportLabel}: Action cluster missing`).toBeTruthy();
  expect(layout.create, `${viewportLabel}: Create button metrics missing`).toBeTruthy();

  expect(
    layout.create!.fullyInsideControls,
    `${viewportLabel}: Create must lie fully inside .list-page__controls`,
  ).toBe(true);

  expect(
    layout.create!.fullyInsideActionCluster,
    `${viewportLabel}: Create must lie fully inside .list-page__toolbar-actions-cluster (not pushed past cluster edge)`,
  ).toBe(true);

  expect(
    layout.create!.intersectClusterWidth,
    `${viewportLabel}: Create should visibly overlap the action cluster (intersection width)`,
  ).toBeGreaterThanOrEqual(40);
}

test.describe("Items /items toolbar — Create not clipped", () => {
  test("stress: many columns + wide table + toolbar metrics + Create usability", async ({ page }, testInfo) => {
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

    const layoutBefore = await collectLayoutSnapshot(page);
    await testInfo.attach("layout-before-modal.json", {
      body: JSON.stringify(layoutBefore, null, 2),
      contentType: "application/json",
    });

    await enableAllColumnsViaModal(page);

    const layoutAfterApply = await collectLayoutSnapshot(page);
    await testInfo.attach("layout-after-apply-all-columns.json", {
      body: JSON.stringify(layoutAfterApply, null, 2),
      contentType: "application/json",
    });

    expect(
      layoutAfterApply.visibleHeaderCellCount,
      `After apply: visible headers (${layoutAfterApply.visibleHeaderCellCount}) must be >= ${MIN_VISIBLE_HEADER_CELLS} (was ${layoutBefore.visibleHeaderCellCount} before modal)`,
    ).toBeGreaterThanOrEqual(MIN_VISIBLE_HEADER_CELLS);

    const widths = [
      520, 500, 480, 460, 440, 420, 400, 380, 360, 340, 320, 300, 280, 260, 240,
    ];
    for (const width of widths) {
      const label = `w${width}`;
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(320);

      const layout = await collectLayoutSnapshot(page);
      await assertLayoutStressAndToolbarHealth(layout, label, testInfo);
      await assertCreateButtonUsable(create, label, testInfo);

      await page.screenshot({
        path: testInfo.outputPath(`toolbar-${label}.png`),
        fullPage: false,
      });
    }
  });
});
