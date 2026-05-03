import { describe, expect, it } from "vitest";
import { createTranslator } from "../../src/shared/i18n/resolve";
import { enMessages } from "../../src/shared/i18n/messages/en";

describe("finance planned profit i18n keys", () => {
  it("resolves new finance keys in English", () => {
    const t = createTranslator(enMessages, enMessages, "en");
    expect(t("finance.plannedProfitSectionTitle")).toBe("Planned profit");
    expect(t("finance.revenue")).toBe("Revenue");
    expect(t("finance.plannedCost")).toBe("Planned cost");
    expect(t("finance.plannedGrossProfit")).toBe("Planned gross profit");
    expect(t("finance.plannedMargin")).toBe("Planned margin");
    expect(t("finance.plannedProfitHint")).toContain("not actual profit");
    expect(t("finance.plannedProfitMissingCostWarning", { count: "2" })).toContain("2");
    expect(t("finance.plannedProfitMissingCostWarning", { count: "2" })).toContain("line");
  });
});
