import type { PurchaseOrderLine } from "./model";
import type {
  PurchaseOrderPaymentRecord,
  PurchaseOrderPaymentStatus,
} from "./purchaseOrderPaymentModel";
import { roundMoney, sumPlanningDocumentLineAmounts } from "@/shared/commercialMoney";

export function computePurchaseOrderTotalFromLines(lines: PurchaseOrderLine[]): number {
  return sumPlanningDocumentLineAmounts(
    lines.map((line) => ({
      qty: line.qty,
      unitPrice:
        typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
          ? line.unitPrice
          : 0,
    })),
  );
}

export type PurchaseOrderPaymentDerived = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PurchaseOrderPaymentStatus;
};

export function derivePurchaseOrderPaymentSummary(
  totalAmount: number,
  payments: PurchaseOrderPaymentRecord[],
): PurchaseOrderPaymentDerived {
  const rawPaid = payments.reduce(
    (sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0),
    0,
  );
  const paidAmount = roundMoney(rawPaid);
  const total = roundMoney(totalAmount);
  const remainingAmount = roundMoney(Math.max(0, total - paidAmount));

  let status: PurchaseOrderPaymentStatus;
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
