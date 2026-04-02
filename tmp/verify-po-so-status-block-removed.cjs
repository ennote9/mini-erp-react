const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:1420';
const OUT_PATH = path.join(__dirname, 'po-so-status-block-removed.json');
const routes = ['/purchase-orders', '/sales-orders'];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1600, height: 980 } });
  await context.addInitScript(() => {
    localStorage.setItem('mini-erp-app-settings-v1', JSON.stringify({ version: 1, settings: { general: { locale: 'ru', theme: 'dark' } } }));
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  const results = [];
  for (const route of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => {
      const controlsText = Array.from(document.querySelectorAll('.list-page__controls button, .list-page__controls [role="button"]')).map((node) => (node.textContent || '').trim()).filter(Boolean);
      const forbidden = ['Все', 'Черновик', 'Подтверждён', 'Подтвержден', 'Закрыт', 'Отменён', 'Отменен'];
      const statusButtons = controlsText.filter((text) => forbidden.some((token) => text.includes(token)));
      return {
        controlsText,
        statusButtons,
        searchVisible: !!document.querySelector('.list-page__controls input'),
      };
    });
    const screenshotPath = path.join(__dirname, `${route.replace(/\//g, '_').replace(/^_/, '')}-status-block-removed.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({ route, state, screenshotPath });
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
