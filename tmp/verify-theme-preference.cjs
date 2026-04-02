const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";
const OUTPUT_PATH = path.join(__dirname, "theme-preference-verification.json");

async function clickSelectOption(page, triggerLabel, optionLabel) {
  await page.getByRole("button", { name: triggerLabel }).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
}

async function currentThemeState(page) {
  return await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    isLight: document.documentElement.classList.contains("light"),
    isDark: document.documentElement.classList.contains("dark"),
    storedSettings: localStorage.getItem("mini-erp-app-settings-v1"),
  }));
}

async function verifyPageLight(page, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  return {
    route,
    theme: await currentThemeState(page),
  };
}

async function main() {
  const consoleErrors = [];
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({ colorScheme: "light" });
  await context.addInitScript(() => {
    const key = "mini-erp-app-settings-v1";
    if (!localStorage.getItem(key)) {
      const payload = {
        version: 1,
        settings: {
          general: {
            locale: "ru",
          },
        },
      };
      localStorage.setItem(key, JSON.stringify(payload));
    }
  });

  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  const result = {
    initialSettingsPage: null,
    themeOptionsRu: [],
    darkSelection: null,
    lightSelection: null,
    systemSelection: null,
    pagesAfterLight: [],
    consoleErrors,
  };

  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Тема" }).waitFor();
  await page.waitForTimeout(250);

  const initialTheme = await currentThemeState(page);
  const initialTriggerText = await page.getByRole("button", { name: "Тема" }).textContent();

  await page.getByRole("button", { name: "Тема" }).click();
  const options = await page.locator('[role="listbox"] button').allTextContents();
  result.themeOptionsRu = options.map((text) => text.trim()).filter(Boolean);
  await page.keyboard.press("Escape");

  result.initialSettingsPage = {
    theme: initialTheme,
    selectedThemeLabel: initialTriggerText ? initialTriggerText.trim() : null,
  };

  await clickSelectOption(page, "Тема", "Тёмная");
  await page.waitForTimeout(300);
  const darkImmediate = await currentThemeState(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  result.darkSelection = {
    afterSelect: darkImmediate,
    afterReload: await currentThemeState(page),
    selectedThemeLabel: (await page.getByRole("button", { name: "Тема" }).textContent())?.trim() ?? null,
  };

  await clickSelectOption(page, "Тема", "Светлая");
  await page.waitForTimeout(300);
  const lightImmediate = await currentThemeState(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  result.lightSelection = {
    afterSelect: lightImmediate,
    afterReload: await currentThemeState(page),
    selectedThemeLabel: (await page.getByRole("button", { name: "Тема" }).textContent())?.trim() ?? null,
  };

  await clickSelectOption(page, "Тема", "Системная");
  await page.waitForTimeout(300);
  const systemImmediate = await currentThemeState(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  result.systemSelection = {
    afterSelect: systemImmediate,
    afterReload: await currentThemeState(page),
    selectedThemeLabel: (await page.getByRole("button", { name: "Тема" }).textContent())?.trim() ?? null,
  };

  await clickSelectOption(page, "Тема", "Светлая");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  result.pagesAfterLight.push(await verifyPageLight(page, "/items"));
  result.pagesAfterLight.push(await verifyPageLight(page, "/purchase-orders"));
  result.pagesAfterLight.push(await verifyPageLight(page, "/stock-balances"));

  await browser.close();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
