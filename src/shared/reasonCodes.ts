/**
 * Disciplined reason-code enums for planning documents (PO/SO) and cancellations.
 * Free text is secondary (e.g. cancel comment); codes are explicit.
 */

export const ZERO_PRICE_LINE_REASON_CODES = [
  "PROMO",
  "SAMPLE",
  "FREE_REPLACEMENT",
  "INTERNAL_USE",
  "PRICE_PENDING",
] as const;

export type ZeroPriceLineReasonCode = (typeof ZERO_PRICE_LINE_REASON_CODES)[number];

export const ZERO_PRICE_LINE_REASON_LABELS: Record<ZeroPriceLineReasonCode, string> = {
  PROMO: "Promotional",
  SAMPLE: "Sample",
  FREE_REPLACEMENT: "Free replacement",
  INTERNAL_USE: "Internal use",
  PRICE_PENDING: "Price pending",
};

export const CANCEL_DOCUMENT_REASON_CODES = [
  "DATA_ENTRY_ERROR",
  "DUPLICATE_DOCUMENT",
  "CUSTOMER_CANCELLED",
  "SUPPLIER_CANCELLED",
  "OPERATIONAL_ISSUE",
  "OTHER",
] as const;

export type CancelDocumentReasonCode = (typeof CANCEL_DOCUMENT_REASON_CODES)[number];

/** Service/API input for cancelling a document (reason required). */
export type CancelDocumentReasonInput = {
  cancelReasonCode: string;
  cancelReasonComment?: string;
};

export const CANCEL_DOCUMENT_REASON_LABELS: Record<CancelDocumentReasonCode, string> = {
  DATA_ENTRY_ERROR: "Data entry error",
  DUPLICATE_DOCUMENT: "Duplicate document",
  CUSTOMER_CANCELLED: "Customer cancelled",
  SUPPLIER_CANCELLED: "Supplier cancelled",
  OPERATIONAL_ISSUE: "Operational issue",
  OTHER: "Other",
};

export function isZeroPriceLineReasonCode(v: unknown): v is ZeroPriceLineReasonCode {
  return (
    typeof v === "string" &&
    (ZERO_PRICE_LINE_REASON_CODES as readonly string[]).includes(v)
  );
}

export function isCancelDocumentReasonCode(v: unknown): v is CancelDocumentReasonCode {
  return (
    typeof v === "string" && (CANCEL_DOCUMENT_REASON_CODES as readonly string[]).includes(v)
  );
}

/** Stored value for a line: only when unit price is zero. */
export function zeroPriceReasonCodeForStore(
  unitPriceRounded: number,
  raw: unknown,
): ZeroPriceLineReasonCode | undefined {
  if (unitPriceRounded !== 0) return undefined;
  if (!isZeroPriceLineReasonCode(raw)) return undefined;
  return raw;
}

export function validateCancelDocumentReasonForm(raw: unknown): string | null {
  if (raw == null || raw === "") return "A cancel reason is required.";
  if (!isCancelDocumentReasonCode(raw)) return "Select a valid cancel reason.";
  return null;
}

/** Optional note; trim; empty → undefined */
export function normalizeCancelReasonComment(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (s === "") return undefined;
  return s.length > 500 ? s.slice(0, 500) : s;
}

/** Posted Receipt / Shipment reversal (MVP): mandatory code, optional comment. */
export const REVERSAL_DOCUMENT_REASON_CODES = [
  "DATA_ENTRY_ERROR",
  "DAMAGE_OR_LOSS",
  "WRONG_WAREHOUSE",
  "WRONG_ITEM_OR_QTY",
  "DUPLICATE_POSTING",
  "OTHER",
] as const;

export type ReversalDocumentReasonCode = (typeof REVERSAL_DOCUMENT_REASON_CODES)[number];

export type ReversalDocumentReasonInput = {
  reversalReasonCode: string;
  reversalReasonComment?: string;
};

export const REVERSAL_DOCUMENT_REASON_LABELS: Record<ReversalDocumentReasonCode, string> = {
  DATA_ENTRY_ERROR: "Data entry error",
  DAMAGE_OR_LOSS: "Damage or loss",
  WRONG_WAREHOUSE: "Wrong warehouse",
  WRONG_ITEM_OR_QTY: "Wrong item or quantity",
  DUPLICATE_POSTING: "Duplicate posting",
  OTHER: "Other",
};

export function isReversalDocumentReasonCode(v: unknown): v is ReversalDocumentReasonCode {
  return (
    typeof v === "string" && (REVERSAL_DOCUMENT_REASON_CODES as readonly string[]).includes(v)
  );
}

export function validateReversalDocumentReasonForm(raw: unknown): string | null {
  if (raw == null || raw === "") return "A reversal reason is required.";
  if (!isReversalDocumentReasonCode(raw)) return "Select a valid reversal reason.";
  return null;
}

/** Same rules as cancel comment (trim, max length). */
export function normalizeReversalReasonComment(raw: unknown): string | undefined {
  return normalizeCancelReasonComment(raw);
}
