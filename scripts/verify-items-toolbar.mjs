/**
 * Headless check: /items toolbar — Create visible, cluster not height-clipped, table scroll width.
 * Run with dev server: npm run dev (port 1420) or tauri dev.
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const shotPath = join(root, "artifacts", "items-toolbar-final.png");

const url =
  process.env.VERIFY_ITEMS_URL ?? "http://127.0.0.1:1420/items";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 520, height: 800 } });

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  // Try to open column settings (EN / RU labels)
  const viewBtn = page
    .getByRole("button", { name: /view settings|настройки вида|вид/i })
    .first();
  if (await viewBtn.isVisible().catch(() => false)) {
    await viewBtn.click();
    await page.waitForTimeout(400);
    // Turn on all visibility toggles in modal (checkboxes)
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const checks = dialog.locator('input[type="checkbox"]');
      const n = await checks.count();
      for (let i = 0; i < n; i++) {
        const box = checks.nth(i);
        if (await box.isVisible().catch(() => false)) {
          const checked = await box.isChecked().catch(() => true);
          if (!checked) await box.click({ force: true }).catch(() => {});
        }
      }
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  await page.setViewportSize({ width: 440, height: 800 });
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const iw = window.innerWidth;
    const cluster = document.querySelector(".list-page__toolbar-actions-cluster");
    const create = document.querySelector(".list-page__controls .list-page__create-btn");
    const scrollHost = document.querySelector("[data-items-table-scroll]");
    const vw = document.documentElement.clientWidth;
    const clusterStyle = cluster ? window.getComputedStyle(cluster) : null;
    let clusterMetrics = null;
    if (cluster) {
      const r = cluster.getBoundingClientRect();
      clusterMetrics = {
        rectHeight: r.height,
        scrollHeight: cluster.scrollHeight,
        clientHeight: cluster.clientHeight,
        computedHeight: clusterStyle?.height,
        computedMinHeight: clusterStyle?.minHeight,
        computedOverflow: clusterStyle?.overflow,
      };
    }
    let createMetrics = null;
    if (create) {
      const r = create.getBoundingClientRect();
      createMetrics = {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        clippedRight: r.right > iw + 0.5,
        clippedLeft: r.left < -0.5,
        fullyVisible: r.left >= -0.5 && r.right <= iw + 0.5 && r.width > 4 && r.height > 4,
      };
    }
    const table = scrollHost?.querySelector("table");
    const hostRect = scrollHost?.getBoundingClientRect();
    const tableScrollW = table?.scrollWidth ?? 0;
    const hostClientW = scrollHost?.clientWidth ?? 0;
    return {
      vw,
      innerWidth: iw,
      cluster: clusterMetrics,
      create: createMetrics,
      tableScrollsInsideHost: tableScrollW > hostClientW + 2,
      hostClientW,
      tableScrollW,
    };
  });

  await page.screenshot({ path: shotPath, fullPage: false });
  writeFileSync(join(root, "artifacts", "items-toolbar-metrics.json"), JSON.stringify(metrics, null, 2), "utf8");

  console.log(JSON.stringify(metrics, null, 2));
  console.log("screenshot:", shotPath);

  const ok =
    metrics.create?.fullyVisible &&
    metrics.cluster &&
    metrics.cluster.rectHeight >= metrics.cluster.scrollHeight - 1;
  if (!ok) {
    console.error("VERIFY_FAIL", { createFullyVisible: metrics.create?.fullyVisible, clusterTallEnough: metrics.cluster ? metrics.cluster.rectHeight >= metrics.cluster.scrollHeight - 1 : false });
    process.exit(1);
  }
} catch (e) {
  console.error(String(e));
  process.exit(2);
} finally {
  await browser.close();
}
