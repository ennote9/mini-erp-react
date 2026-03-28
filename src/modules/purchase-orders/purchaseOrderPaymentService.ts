import { purchaseOrderRepository } from "./repository";
import { purchaseOrderPaymentRepository } from "./purchaseOrderPaymentRepository";
import type { SupplierPaymentMethod } from "./purchaseOrderPaymentModel";
import { roundMoney } from "@/shared/commercialMoney";

export type AddPurchaseOrderPaymentInput = {
  amount: number;
  paidAt: string;
  method: SupplierPaymentMethod;
  reference?: string;
  comment?: string;
};

export type PurchaseOrderPaymentServiceErrorCode =
  | "PO_NOT_FOUND"
  | "PO_CANCELLED"
  | "AMOUNT_INVALID"
  | "PAID_AT_REQUIRED"
  | "PAID_AT_INVALID"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_WRONG_ORDER"
  | "DELETE_FAILED";

export type PurchaseOrderPaymentMutationResult =
  | { success: true; id?: string }
  | { success: false; code: PurchaseOrderPaymentServiceErrorCode };

function validatePaidAt(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function addPurchaseOrderPayment(
  purchaseOrderId: string,
  input: AddPurchaseOrderPaymentInput,
): PurchaseOrderPaymentMutationResult {
  const po = purchaseOrderRepository.getById(purchaseOrderId);
  if (!po) return { success: false, code: "PO_NOT_FOUND" };
  if (po.status === "cancelled") {
    return { success: false, code: "PO_CANCELLED" };
  }

  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, code: "AMOUNT_INVALID" };
  }

  const paidAtRaw = input.paidAt?.trim() ?? "";
  if (paidAtRaw === "") return { success: false, code: "PAID_AT_REQUIRED" };
  const paidAtIso = validatePaidAt(paidAtRaw);
  if (!paidAtIso) return { success: false, code: "PAID_AT_INVALID" };

  const record = purchaseOrderPaymentRepository.create({
    purchaseOrderId,
    amount,
    paidAt: paidAtIso,
    method: input.method,
    ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
    ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
  });
  return { success: true, id: record.id };
}

export function deletePurchaseOrderPayment(
  paymentId: string,
  purchaseOrderId: string,
): PurchaseOrderPaymentMutationResult {
  const payment = purchaseOrderPaymentRepository.list().find((row) => row.id === paymentId);
  if (!payment) return { success: false, code: "PAYMENT_NOT_FOUND" };
  if (payment.purchaseOrderId !== purchaseOrderId) {
    return { success: false, code: "PAYMENT_WRONG_ORDER" };
  }
  const po = purchaseOrderRepository.getById(purchaseOrderId);
  if (!po) return { success: false, code: "PO_NOT_FOUND" };
  if (po.status === "cancelled") {
    return { success: false, code: "PO_CANCELLED" };
  }
  const ok = purchaseOrderPaymentRepository.delete(paymentId);
  return ok ? { success: true } : { success: false, code: "DELETE_FAILED" };
}
