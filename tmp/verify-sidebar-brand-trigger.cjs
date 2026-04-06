const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(__dirname, "verify-sidebar-brand-trigger.json");

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE_URL}/items`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-slot="sidebar"]', { timeout: 15000 });

  const measure = async (label) =>
    page.evaluate((name) => {
      const sidebar = document.querySelector('[data-slot="sidebar"]');
      const inset = document.querySelector('[data-slot="sidebar-inset"]');
      const state = sidebar?.getAttribute("data-state") || null;
      const width = sidebar?.getBoundingClientRect().width || null;
      const insetWidth = inset?.getBoundingClientRect().width || null;
      const hasSeparateTrigger = !!document.querySelector('[data-slot="sidebar-trigger"], [data-sidebar="trigger"]');
      const activeItem = document.querySelector('[data-slot="sidebar-menu-button"][data-active="true"]');
      return {
        label: name,
        state,
        width,
        insetWidth,
        hasSeparateTrigger,
        activeVisible: !!activeItem,
      };
    }, label);

  const brandButton = page.locator('[data-slot="sidebar-header"] [data-slot="sidebar-menu-button"]').first();
  const before = await measure("expanded");

  await brandButton.click();
  await page.waitForTimeout(250);
  const collapsed = await measure("collapsed");

  const tooltipTexts = [];
  const navButtons = page.locator('[data-slot="sidebar-content"] [data-slot="sidebar-menu-button"]');
  const hoverCount = Math.min(5, await navButtons.count());
  for (let i = 0; i < hoverCount; i++) {
    await navButtons.nth(i).hover();
    await page.waitForTimeout(150);
    const tooltip = await page.locator('[role="tooltip"]').first().textContent().catch(() => null);
    if (tooltip) tooltipTexts.push(tooltip.trim());
  }

  await page.goto(`${BASE_URL}/purchase-orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const persistedOnNav = await measure("persisted-on-navigation");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const persistedOnReload = await measure("persisted-on-reload");

  await brandButton.click();
  await page.waitForTimeout(250);
  const reExpanded = await measure("re-expanded");

  await brandButton.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const keyboardCollapsed = await measure("keyboard-collapsed");
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  const keyboardExpanded = await measure("keyboard-expanded");

  const payload = {
    before,
    collapsed,
    tooltipTexts,
    persistedOnNav,
    persistedOnReload,
    reExpanded,
    keyboardCollapsed,
    keyboardExpanded,
    consoleErrors,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

  await page.screenshot({ path: path.join(__dirname, "sidebar-brand-expanded.png"), fullPage: true });
  await brandButton.click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(__dirname, "sidebar-brand-collapsed.png"), fullPage: true });

  await browser.close();
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
