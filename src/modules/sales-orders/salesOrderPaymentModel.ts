/**
 * Customer payment records against sales orders (Phase 1 financial layer).
 * Not accounting / tax / fiscal invoice — operational payment tracking only.
 */

export type CustomerPaymentMethod = "cash" | "bank_transfer" | "card" | "other";

/** Derived from order total vs sum of payments. */
export type SalesOrderPaymentStatus = "unpaid" | "partially_paid" | "paid";

export type SalesOrderPaymentRecord = {
  id: string;
  salesOrderId: string;
  amount: number;
  /** ISO 8601 date-time when payment was received. */
  paidAt: string;
  method: CustomerPaymentMethod;
  reference?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export const CUSTOMER_PAYMENT_METHOD_CODES: CustomerPaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card",
  "other",
];
