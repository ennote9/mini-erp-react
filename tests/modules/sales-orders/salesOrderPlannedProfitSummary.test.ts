import { describe, expect, it } from "vitest";
import {
  deriveSalesOrderPlannedProfitSummary,
  type SalesOrderPlannedProfitLineInput,
} from "@/modules/sales-orders/salesOrderFinance";
import { lineAmountMoney, roundMoney, sumPlanningDocumentLineAmounts } from "@/shared/commercialMoney";

const line = (itemId: string, qty: number, unitPrice: number): SalesOrderPlannedProfitLineInput => ({
  itemId,
  qty,
  unitPrice,
});

describe("deriveSalesOrderPlannedProfitSummary", () => {
  it("empty lines: zero revenue, cost, profit; null margin", () => {
    const r = deriveSalesOrderPlannedProfitSummary([], "2026-01-01", {
      getUnitCost: () => 0,
    });
    expect(r).toEqual({
      revenue: 0,
      plannedCost: 0,
      plannedGrossProfit: 0,
      marginPercent: null,
      missingCostLineCount: 0,
    });
  });

  it("one profitable line: revenue, planned cost, profit, margin", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("a", 2, 10)], "2026-01-01", {
      getUnitCost: () => 6,
    });
    expect(r.revenue).toBe(20);
    expect(r.plannedCost).toBe(12);
    expect(r.plannedGrossProfit).toBe(8);
    expect(r.marginPercent).toBe(40);
    expect(r.missingCostLineCount).toBe(0);
  });

  it("multiple lines: sums match per-line lineAmountMoney and final roundMoney", () => {
    const lines = [line("a", 2, 10), line("b", 1, 7)];
    const getUnitCost = (id: string) => (id === "a" ? 6 : 4);
    const r = deriveSalesOrderPlannedProfitSummary(lines, "2026-01-01", { getUnitCost });

    let costSum = 0;
    for (const l of lines) {
      const q = typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
      costSum += lineAmountMoney(q, getUnitCost(l.itemId) as number);
    }
    expect(r.revenue).toBe(sumPlanningDocumentLineAmounts(lines));
    expect(r.plannedCost).toBe(roundMoney(costSum));
    expect(r.plannedGrossProfit).toBe(roundMoney(r.revenue - r.plannedCost));
    expect(r.marginPercent).toBeCloseTo((11 / 27) * 100, 10);
  });

  it("zero sale price with positive cost: revenue 0, cost positive, negative profit; margin null when revenue 0", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("x", 1, 0)], "2026-01-01", {
      getUnitCost: () => 5,
    });
    expect(r.revenue).toBe(0);
    expect(r.plannedCost).toBe(5);
    expect(r.plannedGrossProfit).toBe(-5);
    expect(r.marginPercent).toBeNull();
  });

  it("sale price below cost: negative planned gross profit and negative marginPercent", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("x", 1, 5)], "2026-01-01", {
      getUnitCost: () => 10,
    });
    expect(r.revenue).toBe(5);
    expect(r.plannedCost).toBe(10);
    expect(r.plannedGrossProfit).toBe(-5);
    expect(r.marginPercent).toBe(-100);
  });

  it("negative unit cost from DI: treated as 0, not counted as missing", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("a", 1, 10)], "2026-01-01", {
      getUnitCost: () => -3,
    });
    expect(r.plannedCost).toBe(0);
    expect(r.missingCostLineCount).toBe(0);
    expect(r.plannedGrossProfit).toBe(10);
  });

  it("missing / invalid unit cost from DI: cost 0, no NaN, missingCostLineCount increments", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("a", 1, 10), line("b", 1, 10)], "2026-01-01", {
      getUnitCost: (id) => (id === "a" ? 4 : undefined),
    });
    expect(r.revenue).toBe(20);
    expect(r.plannedCost).toBe(4);
    expect(r.plannedGrossProfit).toBe(16);
    expect(r.missingCostLineCount).toBe(1);
    expect(Number.isNaN(r.plannedGrossProfit)).toBe(false);
    expect(Number.isNaN(r.marginPercent ?? 0)).toBe(false);
  });

  it("NaN and null from getUnitCost: treated as missing", () => {
    const r = deriveSalesOrderPlannedProfitSummary([line("a", 1, 1), line("b", 1, 1), line("c", 1, 1)], "d", {
      getUnitCost: (id) => (id === "a" ? 1 : id === "b" ? Number.NaN : null),
    });
    expect(r.missingCostLineCount).toBe(2);
    expect(r.plannedCost).toBe(1);
  });

  it("invalid qty / unitPrice: finite totals, no NaN", () => {
    const r = deriveSalesOrderPlannedProfitSummary(
      [
        line("a", Number.NaN, 10),
        line("b", 1, Number.POSITIVE_INFINITY),
        line("c", 1, Number.NaN),
      ],
      "2026-01-01",
      { getUnitCost: () => 1 },
    );
    expect(Number.isNaN(r.revenue)).toBe(false);
    expect(Number.isNaN(r.plannedCost)).toBe(false);
    expect(Number.isNaN(r.plannedGrossProfit)).toBe(false);
    expect(r.revenue).toBe(0);
    expect(r.plannedCost).toBe(2);
    expect(r.marginPercent).toBeNull();
  });

  it("rounding: document-level roundMoney on summed line amounts", () => {
    const lines = [line("a", 3, 1.005), line("b", 1, 0.01)];
    const getUnitCost = () => 1.005;
    const r = deriveSalesOrderPlannedProfitSummary(lines, "2026-01-01", { getUnitCost });

    let manualCost = 0;
    for (const l of lines) {
      const q = typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
      const uc = roundMoney(1.005);
      manualCost += lineAmountMoney(q, uc);
    }
    expect(r.plannedCost).toBe(roundMoney(manualCost));
    expect(r.revenue).toBe(sumPlanningDocumentLineAmounts(lines));
  });
});
