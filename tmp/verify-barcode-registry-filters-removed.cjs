const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(__dirname, "barcode-registry-filters-removed.json");

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

  await page.goto(`${BASE_URL}/barcodes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const state = await page.evaluate(() => {
    const topControls = Array.from(document.querySelectorAll(".list-page__controls-stack select")).map((node) => ({
      ariaLabel: node.getAttribute("aria-label"),
      value: node.value,
    }));
    return {
      topControls,
      searchVisible: !!document.querySelector('input[aria-label]'),
      exportVisible: Array.from(document.querySelectorAll("button")).some((node) =>
        (node.textContent || "").includes("Экспорт"),
      ),
    };
  });

  const screenshotPath = path.join(__dirname, "barcode-registry-filters-removed.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  const payload = { state, consoleErrors, screenshotPath };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
