import { getEffectiveItemBasePriceOrZero } from "@/modules/items/itemPriceService";
import type { SalesOrderLine } from "./model";
import type { SalesOrderPaymentRecord, SalesOrderPaymentStatus } from "./salesOrderPaymentModel";
import { lineAmountMoney, roundMoney, sumPlanningDocumentLineAmounts } from "@/shared/commercialMoney";

/** Minimal line shape for planned (estimated) gross profit on a sales order. */
export type SalesOrderPlannedProfitLineInput = {
  itemId: string;
  qty: number;
  unitPrice: number;
};

export type SalesOrderPlannedProfitSummary = {
  revenue: number;
  plannedCost: number;
  plannedGrossProfit: number;
  marginPercent: number | null;
  missingCostLineCount: number;
};

export type DeriveSalesOrderPlannedProfitOptions = {
  /**
   * Planned purchase unit cost per item on `orderDateYmd`.
   * Return `undefined` / `null` / non-finite values to treat cost as 0 and increment `missingCostLineCount`.
   * Defaults to `getEffectiveItemBasePriceOrZero(itemId, "purchase", orderDateYmd)` (missing vs. real zero is not counted).
   */
  getUnitCost?: (itemId: string, orderDateYmd: string) => number | null | undefined;
};

/** Commercial total from persisted order lines (same basis as customer documents). */
export function computeSalesOrderTotalFromLines(lines: SalesOrderLine[]): number {
  return sumPlanningDocumentLineAmounts(
    lines.map((l) => ({
      qty: l.qty,
      unitPrice: typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice) ? l.unitPrice : 0,
    })),
  );
}

export type SalesOrderPaymentDerived = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: SalesOrderPaymentStatus;
};

/**
 * paidAmount = sum(payments.amount)
 * remainingAmount = max(0, totalAmount - paidAmount)
 * Status: unpaid | partially_paid | paid per Phase 1 rules.
 */
export function deriveSalesOrderPaymentSummary(
  totalAmount: number,
  payments: SalesOrderPaymentRecord[],
): SalesOrderPaymentDerived {
  const rawPaid = payments.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const paidAmount = roundMoney(rawPaid);
  const total = roundMoney(totalAmount);
  const remainingAmount = roundMoney(Math.max(0, total - paidAmount));

  let status: SalesOrderPaymentStatus;
  if (total <= 0) {
    status = paidAmount <= 0 ? "unpaid" : "partially_paid";
  } else if (paidAmount <= 0) {
    status = "unpaid";
  } else if (remainingAmount <= 0) {
    status = "paid";
  } else {
    status = "partially_paid";
  }

  return {
    totalAmount: total,
    paidAmount,
    remainingAmount,
    status,
  };
}

function defaultGetUnitCost(itemId: string, orderDateYmd: string): number {
  return getEffectiveItemBasePriceOrZero(itemId, "purchase", orderDateYmd);
}

function normalizeRevenueLine(l: SalesOrderPlannedProfitLineInput): { qty: number; unitPrice: number } {
  const qty = typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
  const unitPrice = typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
  return { qty, unitPrice };
}

function resolvePlannedUnitCost(raw: number | null | undefined): { unitCost: number; missing: boolean } {
  if (raw === null || raw === undefined) return { unitCost: 0, missing: true };
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { unitCost: 0, missing: true };
  if (raw < 0) return { unitCost: 0, missing: false };
  return { unitCost: roundMoney(raw), missing: false };
}

/**
 * Planned (estimated) gross profit from SO lines: revenue from commercial line amounts,
 * planned cost from per-item purchase base price on the order date (or injected `getUnitCost`).
 */
export function deriveSalesOrderPlannedProfitSummary(
  lines: ReadonlyArray<SalesOrderPlannedProfitLineInput>,
  orderDateYmd: string,
  options?: DeriveSalesOrderPlannedProfitOptions,
): SalesOrderPlannedProfitSummary {
  const getUnitCost = options?.getUnitCost ?? defaultGetUnitCost;

  const revenueLines = lines.map(normalizeRevenueLine);
  const revenue = sumPlanningDocumentLineAmounts(revenueLines);

  let plannedCostSum = 0;
  let missingCostLineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const { qty } = revenueLines[i]!;
    const raw = getUnitCost(l.itemId, orderDateYmd);
    const { unitCost, missing } = resolvePlannedUnitCost(raw);
    if (missing) missingCostLineCount += 1;
    plannedCostSum += lineAmountMoney(qty, unitCost);
  }
  const plannedCost = roundMoney(plannedCostSum);
  const plannedGrossProfit = roundMoney(revenue - plannedCost);

  let marginPercent: number | null = null;
  if (revenue > 0) {
    const m = (plannedGrossProfit / revenue) * 100;
    marginPercent = Number.isFinite(m) ? m : null;
  }

  return {
    revenue,
    plannedCost,
    plannedGrossProfit,
    marginPercent,
    missingCostLineCount,
  };
}
