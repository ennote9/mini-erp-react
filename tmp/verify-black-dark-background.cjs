const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(__dirname, "black-dark-background-verification.json");
const routes = ["/brands", "/barcodes", "/items", "/purchase-orders"];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1600, height: 980 },
  });

  await context.addInitScript(() => {
    localStorage.setItem(
      "mini-erp-app-settings-v1",
      JSON.stringify({
        version: 1,
        settings: {
          general: {
            locale: "ru",
            theme: "dark",
          },
        },
      }),
    );
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  const results = [];

  for (const route of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const pageContent = document.querySelector(".app-page-content");
      const pageContentBg = pageContent ? getComputedStyle(pageContent).backgroundColor : null;
      const topbar = document.querySelector(".app-topbar");
      const topbarBg = topbar ? getComputedStyle(topbar).backgroundColor : null;
      const sidebar = document.querySelector('[data-slot="sidebar"]');
      const sidebarBg = sidebar ? getComputedStyle(sidebar).backgroundColor : null;
      const listFrame = document.querySelector(".list-page__frame");
      const listFrameBg = listFrame ? getComputedStyle(listFrame).backgroundColor : null;
      const listContent = document.querySelector(".list-page__content");
      const listContentBg = listContent ? getComputedStyle(listContent).backgroundColor : null;

      return {
        bodyBg,
        pageContentBg,
        topbarBg,
        sidebarBg,
        listFrameBg,
        listContentBg,
      };
    });

    const screenshotPath = path.join(__dirname, `${route.replace(/\//g, "_").replace(/^_/, "")}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({ route, screenshotPath, state });
  }

  await browser.close();
  const payload = { results, consoleErrors };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
