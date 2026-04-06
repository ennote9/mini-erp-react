const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(__dirname, "sidebar-collapse-verification.json");

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1600, height: 980 },
  });
  await context.addInitScript(() => {
    const key = "mini-erp-app-settings-v1";
    if (!localStorage.getItem(key)) {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          settings: {
            general: {
              locale: "ru",
              theme: "dark",
              sidebarState: "expanded",
            },
          },
        }),
      );
    }
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto(`${BASE_URL}/items`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-slot="sidebar"]', { timeout: 15000 });
  await page.waitForTimeout(250);

  const measure = async (label) =>
    page.evaluate((label) => {
      const sidebar = document.querySelector('[data-slot="sidebar"]');
      const inset = document.querySelector('[data-slot="sidebar-inset"]');
      const trigger = document.querySelector('[data-slot="sidebar-trigger"], [data-sidebar="trigger"]');
      const activeItem = document.querySelector('[data-slot="sidebar-menu-button"][data-active="true"]');
      const accountLabel = Array.from(document.querySelectorAll('[data-slot="sidebar-footer"] span'))
        .find((node) => (node.textContent || "").includes("Учетная")) || null;
      const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : null;
      const insetWidth = inset ? inset.getBoundingClientRect().width : null;
      const accountDisplay = accountLabel ? getComputedStyle(accountLabel).display : null;
      return {
        label,
        sidebarWidth,
        insetWidth,
        triggerVisible: !!trigger,
        activeHasDataAttr: !!activeItem,
        accountDisplay,
        topLabelsVisible: Array.from(document.querySelectorAll('[data-slot="sidebar"] span'))
          .some((node) => (node.textContent || "").includes("Мини ERP")),
      };
    }, label);

  const before = await measure("expanded");

  const brandToggle = page.locator('[data-slot="sidebar-header"] [data-slot="sidebar-menu-button"]').first();
  await brandToggle.waitFor({ state: "visible", timeout: 15000 });
  await brandToggle.click();
  await page.waitForTimeout(300);
  const after = await measure("collapsed");

  const tooltipTexts = [];
  const menuButtons = page.locator('[data-slot="sidebar-menu-button"]');
  const count = await menuButtons.count();
  const hoverCount = Math.min(5, count);
  for (let i = 0; i < hoverCount; i++) {
    await menuButtons.nth(i).hover();
    await page.waitForTimeout(150);
    const tooltip = await page.locator('[role="tooltip"]').first().textContent().catch(() => null);
    if (tooltip) tooltipTexts.push(tooltip.trim());
  }

  await page.goto(`${BASE_URL}/purchase-orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const onPurchaseOrders = await measure("collapsed-purchase-orders");

  await page.goto(`${BASE_URL}/stock-balances`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const onStockBalances = await measure("collapsed-stock-balances");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const afterReload = await measure("collapsed-after-reload");

  await brandToggle.click();
  await page.waitForTimeout(250);
  const reExpanded = await measure("re-expanded");

  await brandToggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const keyboardCollapsed = await measure("keyboard-collapsed");

  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  const keyboardExpanded = await measure("keyboard-expanded");

  const payload = {
    before,
    after,
    tooltipTexts,
    onPurchaseOrders,
    onStockBalances,
    afterReload,
    reExpanded,
    keyboardCollapsed,
    keyboardExpanded,
    consoleErrors,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

  await page.screenshot({ path: path.join(__dirname, "sidebar-expanded.png"), fullPage: true });
  await brandToggle.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, "sidebar-collapsed.png"), fullPage: true });

  await browser.close();
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
