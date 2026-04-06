const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";

async function getOpenListText(page) {
  const list = page.locator('[role="listbox"]').last();
  await list.waitFor({ state: "visible", timeout: 10000 });
  const text = (await list.innerText()).trim();
  return text;
}

async function openAndCheck(page, triggerSelector, label) {
  const trigger = page.locator(triggerSelector).first();
  await trigger.waitFor({ state: "visible", timeout: 10000 });
  const closedLabel = ((await trigger.innerText()) || "").trim();
  await trigger.click();
  const openText = await getOpenListText(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  return {
    label,
    triggerSelector,
    closedLabel,
    hasFakeRu: /(^|\n)\s*Выбрать\s*($|\n)/i.test(openText),
    hasFakeEn: /(^|\n)\s*Select\s*($|\n)/i.test(openText),
    openTextSample: openText.split("\n").slice(0, 8),
  };
}

async function ensureGeneralSection(page) {
  const generalLocaleField = page.locator('[id="general.locale"]').first();
  if (await generalLocaleField.isVisible().catch(() => false)) return;
  const generalButton = page
    .locator("button")
    .filter({ hasText: /General|Общие|Жалпы/i })
    .first();
  if (await generalButton.isVisible().catch(() => false)) {
    await generalButton.click();
    await page.waitForTimeout(200);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1640, height: 1000 },
  });
  await context.addInitScript(() => {
    const key = "mini-erp-app-settings-v1";
    if (!localStorage.getItem(key)) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed?.settings?.general) {
        parsed.settings.general.locale = "ru";
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch {}
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await ensureGeneralSection(page);

  const settingsChecks = [];
  settingsChecks.push(await openAndCheck(page, '[id="general.locale"]', "settings.locale"));
  settingsChecks.push(await openAndCheck(page, '[id="general.theme"]', "settings.theme"));
  settingsChecks.push(await openAndCheck(page, '[id="general.dateFormat"]', "settings.dateFormat"));
  settingsChecks.push(await openAndCheck(page, '[id="general.numberFormat"]', "settings.numberFormat"));

  await page.goto(`${BASE_URL}/purchase-orders/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const poSupplier = await openAndCheck(page, "#po-supplier", "purchaseOrders.supplier");
  const poWarehouse = await openAndCheck(page, "#po-warehouse", "purchaseOrders.warehouse");

  await page.goto(`${BASE_URL}/sales-orders/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const soCustomer = await openAndCheck(page, "#so-customer", "salesOrders.customer");
  const soWarehouse = await openAndCheck(page, "#so-warehouse", "salesOrders.warehouse");

  const payload = {
    settingsChecks,
    extraChecks: [poSupplier, poWarehouse, soCustomer, soWarehouse],
    consoleErrors,
  };

  console.log(JSON.stringify(payload, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
