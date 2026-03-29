const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const APP_ROOT = "http://127.0.0.1:1420";
const SETTINGS_KEY = "mini-erp-app-settings-v1";

function buildSettings(locale = "en") {
  return JSON.stringify({
    version: 1,
    settings: {
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
        locale,
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
    },
  });
}

async function bootstrapPage(page, locale = "en") {
  await page.goto(APP_ROOT, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SETTINGS_KEY, value: buildSettings(locale) },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1480, height: 1200 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    await bootstrapPage(page, "en");
    await page.goto(`${APP_ROOT}/sales-orders/1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".doc-header__title");

    const tabTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="tab"]'))
        .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    );

    await page.getByRole("tab", { name: "Attachments" }).click();
    await page.waitForTimeout(150);

    const attachmentStateBefore = await page.evaluate(() => ({
      url: window.location.href,
      hasSectionTitle: Boolean(
        Array.from(document.querySelectorAll("h3")).find(
          (node) => (node.textContent || "").replace(/\s+/g, " ").trim() === "Attachments",
        ),
      ),
      emptyTextPresent: (document.body.textContent || "").includes("No attachments yet."),
      rows: document.querySelectorAll("tbody tr").length,
    }));

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(process.cwd(), "package.json"));
    await page.waitForTimeout(1200);

    const attachmentStateAfterAdd = await page.evaluate(() => ({
      rows: document.querySelectorAll("tbody tr").length,
      hasPackageJson: (document.body.textContent || "").includes("package.json"),
    }));

    await page.reload({ waitUntil: "networkidle" });
    const urlAfterReload = page.url();
    const postReloadState = await page.evaluate(() => ({
      rows: document.querySelectorAll("tbody tr").length,
      hasPackageJson: (document.body.textContent || "").includes("package.json"),
      buttonLabels: Array.from(document.querySelectorAll("button"))
        .map((button) => button.getAttribute("aria-label") || button.getAttribute("title") || (button.textContent || "").trim())
        .filter(Boolean),
    }));

    if (postReloadState.rows > 0) {
      page.once("dialog", (dialog) => dialog.accept());
      const removeButton = page.locator('button[aria-label="Remove attachment"], button[title="Remove attachment"]').first();
      if ((await removeButton.count()) > 0) {
        await removeButton.click();
        await page.waitForTimeout(300);
      }
    }

    const attachmentStateAfterRemove = await page.evaluate(() => ({
      rows: document.querySelectorAll("tbody tr").length,
      emptyTextPresent: (document.body.textContent || "").includes("No attachments yet."),
    }));

    const result = {
      tabTexts,
      attachmentStateBefore,
      attachmentStateAfterAdd,
      urlAfterReload,
      postReloadState,
      attachmentStateAfterRemove,
    };

    const outPath = path.join(process.cwd(), "tmp", "sales-order-attachments-tab-verification.json");
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(outPath);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
