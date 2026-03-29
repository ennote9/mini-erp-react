const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const STATUS_WORDS = [
  "Draft",
  "Confirmed",
  "Posted",
  "Cancelled",
  "Reversed",
  "Closed",
  "Черновик",
  "Подтверждён",
  "Проведён",
  "Отменён",
  "Сторнирован",
  "Закрыт",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function go(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
}

async function clickIfVisible(page, nameOrRegex) {
  const button = page.getByRole("button", { name: nameOrRegex });
  if ((await button.count()) > 0 && (await button.first().isVisible())) {
    await button.first().click();
    return true;
  }
  return false;
}

async function headerStatus(page) {
  const row = page.locator(".doc-header__title-row").first();
  if ((await row.count()) === 0) return null;
  const text = await row.innerText();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => STATUS_WORDS.includes(line)) ?? null;
}

async function visibleErrors(page) {
  const loc = page.locator('[role="alert"], .text-destructive');
  const count = await loc.count();
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const item = loc.nth(i);
    if (await item.isVisible()) {
      const text = (await item.innerText()).trim();
      if (text) values.push(text);
    }
  }
  return [...new Set(values)].slice(0, 10);
}

async function visibleButtons(page) {
  const names = [
    "Post",
    "Reverse document",
    "Create shipment",
    "Allocate stock",
    "Confirm",
    "Cancel document",
  ];
  const result = {};
  for (const name of names) {
    const loc = page.getByRole("button", { name: new RegExp(name, "i") });
    result[name] = (await loc.count()) > 0 && (await loc.first().isVisible());
  }
  return result;
}

async function snapshot(page, label, consoleErrors) {
  return {
    label,
    url: page.url(),
    status: await headerStatus(page),
    errors: await visibleErrors(page),
    buttons: await visibleButtons(page),
    bodyExcerpt: (await page.locator("body").innerText()).slice(0, 2000),
    consoleErrors: consoleErrors.slice(),
  };
}

async function chooseReasonAndConfirm(page, kind) {
  const confirmName = kind === "reverse" ? /Confirm reversal/i : /Confirm cancellation/i;
  const trigger = page.locator('button[aria-haspopup="listbox"]').last();
  if ((await trigger.count()) > 0 && (await trigger.isVisible())) {
    await trigger.click();
    const options = page.locator('[role="option"] button');
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && !/select/i.test(text)) {
        await options.nth(i).click();
        break;
      }
    }
  }
  await page.getByRole("button", { name: confirmName }).click();
}

async function ensureReceiptDraft(page) {
  await go(page, "/purchase-orders/1");
  await clickIfVisible(page, /Confirm/i);
  await page.waitForLoadState("networkidle");
  if (await clickIfVisible(page, /Open draft receipt/i)) {
    await page.waitForLoadState("networkidle");
    return;
  }
  await clickIfVisible(page, /Create receipt/i);
  await page.waitForURL(/\/receipts\/\d+/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

async function ensureShipmentDraftIfPossible(page) {
  await go(page, "/sales-orders/1");
  await clickIfVisible(page, /Confirm/i);
  await page.waitForLoadState("networkidle");
  await clickIfVisible(page, /Allocate stock/i);
  await page.waitForLoadState("networkidle");
  const clicked = await clickIfVisible(page, /Create shipment/i);
  if (!clicked) return false;
  try {
    await page.waitForURL(/\/shipments\/\d+/, { timeout: 6000 });
    await page.waitForLoadState("networkidle");
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(10000);
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const result = {
    receipt: {},
    shipment: {},
    overallConsoleErrors: null,
  };

  await go(page, "/");

  await ensureReceiptDraft(page);
  result.receipt.beforePost = await snapshot(page, "receipt-before-post", consoleErrors);
  await clickIfVisible(page, /Post/i);
  await sleep(2500);
  result.receipt.afterPostImmediate = await snapshot(page, "receipt-after-post-immediate", consoleErrors);
  await page.reload({ waitUntil: "networkidle" });
  result.receipt.afterPostRefresh = await snapshot(page, "receipt-after-post-refresh", consoleErrors);

  const shipmentReached = await ensureShipmentDraftIfPossible(page);
  if (shipmentReached) {
    result.shipment.beforePost = await snapshot(page, "shipment-before-post", consoleErrors);
    await clickIfVisible(page, /Post/i);
    await sleep(2500);
    result.shipment.afterPostImmediate = await snapshot(page, "shipment-after-post-immediate", consoleErrors);
    if (await clickIfVisible(page, /Reverse document/i)) {
      await chooseReasonAndConfirm(page, "reverse");
      await sleep(2500);
      result.shipment.afterReverseImmediate = await snapshot(page, "shipment-after-reverse-immediate", consoleErrors);
    }
    await page.reload({ waitUntil: "networkidle" });
    result.shipment.afterRefresh = await snapshot(page, "shipment-after-refresh", consoleErrors);
  } else {
    result.shipment.blockedAtSalesOrder = await snapshot(page, "sales-order-blocked-create-shipment", consoleErrors);
  }

  await go(page, "/receipts/1");
  result.receipt.beforeReverse = await snapshot(page, "receipt-before-reverse", consoleErrors);
  if (await clickIfVisible(page, /Reverse document/i)) {
    await chooseReasonAndConfirm(page, "reverse");
    await sleep(2500);
    result.receipt.afterReverseImmediate = await snapshot(page, "receipt-after-reverse-immediate", consoleErrors);
  }
  await page.reload({ waitUntil: "networkidle" });
  result.receipt.afterReverseRefresh = await snapshot(page, "receipt-after-reverse-refresh", consoleErrors);

  result.overallConsoleErrors = [...consoleErrors];
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
