import type { SalesOrderLine } from "./model";
import type { SalesOrderPaymentRecord, SalesOrderPaymentStatus } from "./salesOrderPaymentModel";
import { roundMoney, sumPlanningDocumentLineAmounts } from "@/shared/commercialMoney";

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
