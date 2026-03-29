const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickIfVisible(page, nameOrRegex) {
  const button = page.getByRole("button", { name: nameOrRegex });
  if ((await button.count()) > 0 && (await button.first().isVisible())) {
    await button.first().click();
    return true;
  }
  return false;
}

async function getBadgeStatus(page) {
  const candidates = [
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
  for (const text of candidates) {
    const locator = page.getByText(text, { exact: true });
    if ((await locator.count()) > 0 && (await locator.first().isVisible())) return text;
  }
  return null;
}

async function maybeSelectFirstReasonAndConfirm(page, kind) {
  const titleRegex =
    kind === "reverse"
      ? /Reverse|Сторно|Подтвердить сторно/i
      : /Cancel|Отмена|Подтвердить отмену/i;
  const dialog = page.getByRole("dialog").filter({ has: page.getByText(titleRegex) });
  if ((await dialog.count()) === 0) return false;
  const trigger = dialog.locator('button[aria-haspopup="listbox"]').first();
  if (await trigger.isVisible()) {
    await trigger.click();
    const options = page.locator('[role="option"] button');
    const optionCount = await options.count();
    for (let i = 0; i < optionCount; i += 1) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && !/выберите|select/i.test(text)) {
        await options.nth(i).click();
        break;
      }
    }
  }
  const confirmText =
    kind === "reverse" ? /Confirm reversal|Подтвердить сторно/i : /Confirm cancellation|Подтвердить отмену/i;
  await page.getByRole("button", { name: confirmText }).click();
  return true;
}

async function waitForStatusChangeOrIssue(page, previousStatus, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const status = await getBadgeStatus(page);
    const issueStrip = page.locator('[data-slot="alert"], [role="alert"], .doc-issue-strip, .text-destructive').filter({ hasText: /./ }).first();
    const hasIssue = (await issueStrip.count()) > 0 && (await issueStrip.isVisible());
    if (status && status !== previousStatus) {
      return { kind: "status", value: status, elapsedMs: Date.now() - started };
    }
    if (hasIssue) {
      const text = (await issueStrip.innerText()).trim();
      return { kind: "issue", value: text, elapsedMs: Date.now() - started };
    }
    await sleep(150);
  }
  return { kind: "timeout", value: null, elapsedMs: timeout };
}

async function countEventLogRows(page) {
  const rows = page.locator("text=/document_|created|posted|reversed|cancelled|создан|провед|сторнир|отмен/i");
  return rows.count();
}

async function go(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
}

async function ensurePurchaseOrderConfirmedAndOpenReceipt(page, result) {
  await go(page, "/purchase-orders/1");
  await page.waitForLoadState("networkidle");
  const bodyText = await page.locator("body").innerText();
  if (!/Purchase Order|Заказ на покупку|PO000001|Supplier|Поставщик|Покупк/i.test(bodyText)) {
    throw new Error(`Unexpected PO page content: ${bodyText.slice(0, 1200)}`);
  }
  if (await clickIfVisible(page, /Confirm|Подтвердить/i)) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
  }
  if (await clickIfVisible(page, /Open draft receipt|Открыть черновик поступления/i)) {
    await page.waitForLoadState("networkidle");
    return;
  }
  if (await clickIfVisible(page, /Open latest receipt|Открыть последнее поступление/i)) {
    await page.waitForLoadState("networkidle");
    return;
  }
  const created = await clickIfVisible(page, /Create receipt|Создать поступление/i);
  result.receiptCreationAction = created ? "created" : "not_found";
  if (created) {
    try {
      await page.waitForURL(/\/receipts\/\d+/, { timeout: 10000 });
      await page.waitForLoadState("networkidle");
    } catch {
      result.receiptCreationDebug = {
        url: page.url(),
        body: (await page.locator("body").innerText()).slice(0, 2000),
      };
    }
  }
}

async function ensureSalesOrderConfirmedAllocatedAndOpenShipment(page, result) {
  await go(page, "/sales-orders/1");
  await page.waitForLoadState("networkidle");
  const bodyText = await page.locator("body").innerText();
  if (!/Sales Order|Заказ на продажу|SO000001|Customer|Клиент|Продаж/i.test(bodyText)) {
    throw new Error(`Unexpected SO page content: ${bodyText.slice(0, 1200)}`);
  }
  if (await clickIfVisible(page, /Confirm|Подтвердить/i)) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
  }
  if (await clickIfVisible(page, /Allocate stock|Зарезервировать/i)) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
  }
  const created = await clickIfVisible(page, /Create shipment|Создать отгрузку/i);
  result.shipmentCreationAction = created ? "created_or_opened" : "not_found";
  if (created) {
    try {
      await page.waitForURL(/\/shipments\/\d+/, { timeout: 10000 });
      await page.waitForLoadState("networkidle");
    } catch {
      result.shipmentCreationDebug = {
        url: page.url(),
        body: (await page.locator("body").innerText()).slice(0, 2000),
      };
    }
  }
}

async function verifyReceipt(page, consoleErrors, options = {}) {
  const { doReverse = true } = options;
  const result = {
    route: page.url(),
    initialStatus: await getBadgeStatus(page),
    post: null,
    reverse: null,
    refreshStatusAfterPost: null,
    refreshStatusAfterReverse: null,
    consoleErrors,
  };

  const postButton = page.getByRole("button", { name: /Post|Провести/i });
  if ((await postButton.count()) > 0 && (await postButton.first().isVisible())) {
    const before = Date.now();
    const preStatus = await getBadgeStatus(page);
    const preEventCount = await countEventLogRows(page);
    await postButton.first().click();
    const outcome = await waitForStatusChangeOrIssue(page, preStatus);
    result.post = {
      preStatus,
      disabledImmediately: await postButton.first().isDisabled().catch(() => null),
      outcome,
      eventCountBefore: preEventCount,
      eventCountAfter: await countEventLogRows(page),
      clickToOutcomeMs: Date.now() - before,
    };
    await page.reload({ waitUntil: "networkidle" });
    result.refreshStatusAfterPost = await getBadgeStatus(page);
  } else {
    result.post = { skipped: true, reason: "post_button_not_visible" };
  }

  const reverseButton = page.getByRole("button", { name: /Reverse document|Сторнировать документ/i });
  if (!doReverse) {
    result.reverse = { skipped: true, reason: "deferred_until_after_shipment" };
  } else if ((await reverseButton.count()) > 0 && (await reverseButton.first().isVisible())) {
    const preStatus = await getBadgeStatus(page);
    const preEventCount = await countEventLogRows(page);
    await reverseButton.first().click();
    await maybeSelectFirstReasonAndConfirm(page, "reverse");
    const outcome = await waitForStatusChangeOrIssue(page, preStatus);
    result.reverse = {
      preStatus,
      outcome,
      eventCountBefore: preEventCount,
      eventCountAfter: await countEventLogRows(page),
    };
    await page.reload({ waitUntil: "networkidle" });
    result.refreshStatusAfterReverse = await getBadgeStatus(page);
  } else {
    result.reverse = { skipped: true, reason: "reverse_button_not_visible" };
  }

  return result;
}

async function verifyShipment(page, consoleErrors) {
  const result = {
    route: page.url(),
    initialStatus: await getBadgeStatus(page),
    post: null,
    reverse: null,
    refreshStatusAfterPost: null,
    refreshStatusAfterReverse: null,
    consoleErrors,
  };

  const postButton = page.getByRole("button", { name: /Post|Провести/i });
  if ((await postButton.count()) > 0 && (await postButton.first().isVisible())) {
    const before = Date.now();
    const preStatus = await getBadgeStatus(page);
    const preEventCount = await countEventLogRows(page);
    await postButton.first().click();
    const outcome = await waitForStatusChangeOrIssue(page, preStatus);
    result.post = {
      preStatus,
      disabledImmediately: await postButton.first().isDisabled().catch(() => null),
      outcome,
      eventCountBefore: preEventCount,
      eventCountAfter: await countEventLogRows(page),
      clickToOutcomeMs: Date.now() - before,
    };
    await page.reload({ waitUntil: "networkidle" });
    result.refreshStatusAfterPost = await getBadgeStatus(page);
  } else {
    result.post = { skipped: true, reason: "post_button_not_visible" };
  }

  const reverseButton = page.getByRole("button", { name: /Reverse document|Сторнировать документ/i });
  if ((await reverseButton.count()) > 0 && (await reverseButton.first().isVisible())) {
    const preStatus = await getBadgeStatus(page);
    const preEventCount = await countEventLogRows(page);
    await reverseButton.first().click();
    await maybeSelectFirstReasonAndConfirm(page, "reverse");
    const outcome = await waitForStatusChangeOrIssue(page, preStatus);
    result.reverse = {
      preStatus,
      outcome,
      eventCountBefore: preEventCount,
      eventCountAfter: await countEventLogRows(page),
    };
    await page.reload({ waitUntil: "networkidle" });
    result.refreshStatusAfterReverse = await getBadgeStatus(page);
  } else {
    result.reverse = { skipped: true, reason: "reverse_button_not_visible" };
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(8000);
  const consoleMessages = [];
  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleMessages.push(entry);
  });
  page.on("pageerror", (err) => {
    consoleMessages.push({ type: "pageerror", text: String(err) });
  });

  const result = {
    receipt: null,
    receiptAfterShipment: null,
    shipment: null,
    consoleErrors: [],
  };

  console.log("[step] home");
  await go(page, "/");
  console.log("[step] purchase-order");
  await ensurePurchaseOrderConfirmedAndOpenReceipt(page, result);
  console.log(`[debug] receipt-open-url=${page.url()}`);
  console.log("[step] receipt");
  result.receipt = await verifyReceipt(page, consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror"), { doReverse: false });
  console.log(`[debug] receipt-status-after=${result.receipt.refreshStatusAfterPost ?? result.receipt.initialStatus}`);

  console.log("[step] sales-order");
  await ensureSalesOrderConfirmedAllocatedAndOpenShipment(page, result);
  console.log(`[debug] shipment-open-url=${page.url()}`);
  console.log("[step] shipment");
  if (/\/shipments\/\d+/.test(page.url())) {
    result.shipment = await verifyShipment(page, consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror"));
  } else {
    result.shipment = {
      skipped: true,
      reason: "shipment_route_not_reached",
      currentUrl: page.url(),
      creationDebug: result.shipmentCreationDebug ?? null,
    };
  }

  if (/\/receipts\/\d+/.test(result.receipt.route) || /\/receipts\/\d+/.test(page.url())) {
    console.log("[step] receipt-reverse");
    await go(page, result.receipt.route.replace(BASE_URL, ""));
    result.receiptAfterShipment = await verifyReceipt(page, consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror"), { doReverse: true });
  }

  result.consoleErrors = consoleMessages.filter((m) => m.type === "error" || m.type === "pageerror");

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
