/** Customer-side financial layer (Phase 1) — not tax/fiscal accounting. */
export const financeEn = {
  sectionTitle: "Payment & invoice",
  sectionHint:
    "Track customer payments against this order. The payment request (invoice) is separate from the preliminary customer document.",
  paymentStatusLabel: "Payment status",
  paymentStatus: {
    unpaid: "Unpaid",
    partially_paid: "Partially paid",
    paid: "Paid",
  },
  orderTotal: "Order total",
  paidTotal: "Paid",
  remaining: "Remaining",
  openCustomerInvoice: "Open payment request",
  openCustomerInvoiceShort: "Payment request",
  invoiceTitle: "Payment request",
  invoiceSubtitle: "Sales order bill — operational document, not a tax invoice.",
  invoiceDisclaimer:
    "This document summarizes amounts due on the sales order for operational follow-up. It is not a fiscal or tax invoice unless your process defines it as such separately.",
  sectionPaymentSummary: "Amounts",
  sectionLines: "Commercial lines",
  dueDate: "Due date",
  paymentHistory: "Recorded payments",
  noPayments: "No payments recorded yet.",
  addPayment: "Record payment",
  amount: "Amount",
  paidAt: "Received at",
  method: "Method",
  reference: "Reference",
  comment: "Comment",
  paymentMethod: {
    cash: "Cash",
    bank_transfer: "Bank transfer",
    card: "Card",
    other: "Other",
  },
  deletePayment: "Remove payment",
  deletePaymentConfirm: "Remove this payment record?",
  validation: {
    amountPositive: "Enter an amount greater than zero.",
    paidAtRequired: "Date and time of payment is required.",
  },
  errors: {
    generic: "Could not save payment.",
    deleteFailed: "Could not remove payment.",
    soNotFound: "Sales order not found.",
    soCancelled: "Payments cannot be changed on a cancelled sales order.",
    amountInvalid: "Amount must be greater than zero.",
    paidAtRequired: "Date and time of payment is required.",
    paidAtInvalid: "Invalid payment date or time.",
    paymentNotFound: "Payment not found.",
    paymentWrongOrder: "This payment does not belong to this sales order.",
  },
  invoicePreparedFrom: "Prepared from sales order {{number}}",
  printedAt: "Printed",
  invoiceUnavailable:
    "The payment request is not available for cancelled orders or orders without lines.",
  invoiceNeedsLines:
    "Add at least one commercial line to this order to track payments and open the payment request.",
  readOnlyCancelled:
    "This order is cancelled — payment totals are shown for reference; you cannot add or remove payments.",
} as const;
