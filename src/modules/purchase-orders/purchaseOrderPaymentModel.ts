export type SupplierPaymentMethod = "cash" | "bank_transfer" | "card" | "other";

export type PurchaseOrderPaymentStatus = "unpaid" | "partially_paid" | "paid";

export type PurchaseOrderPaymentRecord = {
  id: string;
  purchaseOrderId: string;
  amount: number;
  paidAt: string;
  method: SupplierPaymentMethod;
  reference?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export const SUPPLIER_PAYMENT_METHOD_CODES: SupplierPaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card",
  "other",
];
