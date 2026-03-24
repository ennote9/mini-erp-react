const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:4173/items/1";
const SETTINGS_KEY = "mini-erp-app-settings-v1";

const baseSettings = {
  general: {
    workspaceMode: "advanced",
    profileOverrides: {
      documentEventLog: true,
      reverseDocumentActions: true,
      stockMovementsNav: true,
      advancedStockBalanceAnalytics: true,
      stockBalanceSourceModal: true,
      allocationControls: true,
    },
    locale: "en",
    theme: "dark",
    dateFormat: "iso",
    numberFormat: "commaDot",
    hotkeysEnabled: true,
  },
  documents: {
    blockConfirmWhenPlanningHasBlockingErrors: true,
    blockPostWhenFactualHasBlockingErrors: true,
    showDocumentEventLog: true,
    requireCancelReason: true,
    requireReversalReason: true,
    autoClosePlanningOnFullFulfillment: true,
    singleDraftReceiptPerPurchaseOrder: true,
    singleDraftShipmentPerSalesOrder: true,
  },
  inventory: {
    reservationsEnabled: true,
    requireReservationBeforeShipment: true,
    allocationMode: "manual",
    releaseReservationsOnSalesOrderCancel: true,
    releaseReservationsOnSalesOrderClose: true,
    reconcileReservationsOnSalesOrderSaveConfirm: true,
  },
  commercial: {
    moneyDecimalPlaces: 2,
    zeroPriceLinesRequireReason: true,
    partnerTermsOverwrite: "document_wins",
  },
  dataAudit: {
    auditLogEnabled: true,
    showAppVersion: true,
  },
};

async function verifyLocale(browser, locale) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  const payload = JSON.stringify({
    version: 1,
    settings: {
      ...baseSettings,
      general: {
        ...baseSettings.general,
        locale,
      },
    },
  });

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: SETTINGS_KEY, value: payload },
  );

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".doc-header__title");
  await page.waitForTimeout(300);

  const summary = await page.evaluate(() => {
    const findText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim() : null;
    };

    const topBar = findText(".app-topbar__title");
    const header = findText(".doc-header__title");

    const tabData = Array.from(document.querySelectorAll('[role="tab"]')).map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        text: (el.textContent || "").trim(),
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth,
      };
    });

    const summaryTitleCandidates = localeText("Barcode summary", "Сводка по штрихкодам");
    const summaryTitleNode = Array.from(document.querySelectorAll("p")).find((el) =>
      summaryTitleCandidates.includes((el.textContent || "").trim()),
    );
    let barcodeSummary = null;
    if (summaryTitleNode && summaryTitleNode.parentElement) {
      const paragraphs = Array.from(summaryTitleNode.parentElement.querySelectorAll("p")).map((el) =>
        (el.textContent || "").trim(),
      );
      barcodeSummary = {
        title: paragraphs[0] || null,
        primary: paragraphs[1] || null,
        count: paragraphs[2] || null,
      };
    }

    function localeText(en, ru) {
      return [en, ru];
    }

    return {
      topBar,
      header,
      tabs: tabData,
      barcodeSummary,
    };
  });

  const screenshotPath = path.join(process.cwd(), "tmp", `item-page-${locale}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();

  return { locale, screenshotPath, ...summary };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const locale of ["en", "ru"]) {
      results.push(await verifyLocale(browser, locale));
    }
    const outPath = path.join(process.cwd(), "tmp", "item-page-verification.json");
    await fs.writeFile(outPath, JSON.stringify(results, null, 2));
    console.log(outPath);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
