import { salesOrderRepository } from "./repository";
import { salesOrderPaymentRepository } from "./salesOrderPaymentRepository";
import type { CustomerPaymentMethod } from "./salesOrderPaymentModel";
import { roundMoney } from "@/shared/commercialMoney";

export type AddSalesOrderPaymentInput = {
  amount: number;
  paidAt: string;
  method: CustomerPaymentMethod;
  reference?: string;
  comment?: string;
};

export type PaymentServiceErrorCode =
  | "SO_NOT_FOUND"
  | "SO_CANCELLED"
  | "AMOUNT_INVALID"
  | "PAID_AT_REQUIRED"
  | "PAID_AT_INVALID"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_WRONG_ORDER"
  | "DELETE_FAILED";

export type PaymentMutationResult =
  | { success: true; id?: string }
  | { success: false; code: PaymentServiceErrorCode };

function validatePaidAt(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function addSalesOrderPayment(
  salesOrderId: string,
  input: AddSalesOrderPaymentInput,
): PaymentMutationResult {
  const so = salesOrderRepository.getById(salesOrderId);
  if (!so) return { success: false, code: "SO_NOT_FOUND" };
  if (so.status === "cancelled") {
    return { success: false, code: "SO_CANCELLED" };
  }

  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, code: "AMOUNT_INVALID" };
  }

  const t = input.paidAt?.trim() ?? "";
  if (t === "") return { success: false, code: "PAID_AT_REQUIRED" };
  const paidAtIso = validatePaidAt(t);
  if (!paidAtIso) return { success: false, code: "PAID_AT_INVALID" };

  const rec = salesOrderPaymentRepository.create({
    salesOrderId,
    amount,
    paidAt: paidAtIso,
    method: input.method,
    ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
    ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
  });
  return { success: true, id: rec.id };
}

export function deleteSalesOrderPayment(paymentId: string, salesOrderId: string): PaymentMutationResult {
  const p = salesOrderPaymentRepository.list().find((x) => x.id === paymentId);
  if (!p) return { success: false, code: "PAYMENT_NOT_FOUND" };
  if (p.salesOrderId !== salesOrderId) {
    return { success: false, code: "PAYMENT_WRONG_ORDER" };
  }
  const so = salesOrderRepository.getById(salesOrderId);
  if (!so) return { success: false, code: "SO_NOT_FOUND" };
  if (so.status === "cancelled") {
    return { success: false, code: "SO_CANCELLED" };
  }
  const ok = salesOrderPaymentRepository.delete(paymentId);
  return ok ? { success: true } : { success: false, code: "DELETE_FAILED" };
}
