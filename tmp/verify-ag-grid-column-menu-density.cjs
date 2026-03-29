const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:1420";
const OUT_PATH = path.join(process.cwd(), "tmp", "ag-grid-column-menu-density-verification.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForGrid(page) {
  await page.locator(".ag-root-wrapper").first().waitFor({ state: "visible" });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  try {
    await page.goto(`${BASE_URL}/items`, { waitUntil: "domcontentloaded" });
    await waitForGrid(page);

    const headerCell = page.locator(".ag-header-cell").filter({ hasText: "Code" }).first();
    await headerCell.waitFor({ state: "visible" });
    const menuTrigger = headerCell.getByRole("button", { name: "Column menu" }).first();
    await menuTrigger.click({ force: true });

    const popup = page.locator("[data-slot='popover-content']").last();
    await popup.waitFor({ state: "visible" });

    const headerBox = await headerCell.boundingBox();
    const popupBox = await popup.boundingBox();
    assert(headerBox, "Expected Code header bounds");
    assert(popupBox, "Expected popup bounds");

    const leftOffset = Math.round(popupBox.x - headerBox.x);
    const rightOverhang = Math.round(popupBox.x + popupBox.width - (headerBox.x + headerBox.width));

    assert(leftOffset <= 16, `Popup drifted too far right from header start: ${leftOffset}px`);
    assert(popupBox.width <= 286, `Popup width stayed too large: ${popupBox.width}px`);

    const sortAscendingButton = popup.getByRole("button", { name: "Sort ascending" });
    const resetButton = popup.getByRole("button", { name: "Reset" });
    const okButton = popup.getByRole("button", { name: "OK" });
    const valueInput = popup.getByPlaceholder("Value");
    const operatorSelect = popup.locator("select").first();

    const sortButtonBox = await sortAscendingButton.boundingBox();
    const resetButtonBox = await resetButton.boundingBox();
    const okButtonBox = await okButton.boundingBox();
    const valueInputBox = await valueInput.boundingBox();
    assert(sortButtonBox, "Expected sort button bounds");
    assert(resetButtonBox, "Expected reset button bounds");
    assert(okButtonBox, "Expected OK button bounds");
    assert(valueInputBox, "Expected value input bounds");

    assert(sortButtonBox.height <= 30, `Sort button height stayed too large: ${sortButtonBox.height}px`);
    assert(resetButtonBox.height <= 30, `Reset button height stayed too large: ${resetButtonBox.height}px`);
    assert(okButtonBox.height <= 30, `OK button height stayed too large: ${okButtonBox.height}px`);
    assert(valueInputBox.height <= 30, `Value input height stayed too large: ${valueInputBox.height}px`);

    const popupClass = (await popup.getAttribute("class")) || "";
    assert(
      popupClass.includes("w-[17.5rem]") && popupClass.includes("p-2.5"),
      "Popup class did not reflect compact width/padding",
    );

    const firstCode = ((await page.locator('.ag-cell[col-id="code"]').first().textContent()) || "").trim();
    assert(firstCode, "Expected first item code");

    await sortAscendingButton.click();
    await page.waitForTimeout(300);
    assert(new URL(page.url()).searchParams.get("sort") === "code:asc", "Sort ascending did not persist in URL");

    await operatorSelect.selectOption("equals");
    await valueInput.fill(firstCode);
    await okButton.click();
    await page.waitForTimeout(300);
    assert(
      new URL(page.url()).searchParams.getAll("cf").includes(`code~equals~${firstCode}`),
      "Filter OK did not persist code filter in URL",
    );

    const visibleCodes = await page.locator('.ag-cell[col-id="code"]').allTextContents();
    assert(
      visibleCodes.map((value) => value.trim()).includes(firstCode),
      "Filtered grid did not retain the selected code",
    );

    const results = {
      baseUrl: BASE_URL,
      verifiedAt: new Date().toISOString(),
      header: {
        label: "Code",
        x: Math.round(headerBox.x),
        width: Math.round(headerBox.width),
      },
      popup: {
        x: Math.round(popupBox.x),
        width: Math.round(popupBox.width),
        height: Math.round(popupBox.height),
        leftOffset,
        rightOverhang,
        className: popupClass,
      },
      density: {
        sortButtonHeight: Math.round(sortButtonBox.height),
        resetButtonHeight: Math.round(resetButtonBox.height),
        okButtonHeight: Math.round(okButtonBox.height),
        valueInputHeight: Math.round(valueInputBox.height),
      },
      logicStillWorks: {
        sortUrl: page.url(),
        firstCode,
      },
    };

    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
