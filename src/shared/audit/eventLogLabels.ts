import type { AuditEventType } from "./eventLogTypes";
import {
  REVERSAL_DOCUMENT_REASON_LABELS,
  type ReversalDocumentReasonCode,
} from "../reasonCodes";

const LABELS: Record<AuditEventType, string> = {
  document_created: "Created",
  document_saved: "Saved",
  document_confirmed: "Confirmed",
  document_posted: "Posted",
  document_cancelled: "Cancelled",
  document_reversed: "Reversed",
  stock_allocated: "Stock allocated",
  reservation_released: "Reservations released",
  reservation_reconciled: "Reservations reconciled",
  reservation_consumed: "Reservation consumed",
  line_added: "Line added",
  line_removed: "Line removed",
  line_qty_changed: "Quantity changed",
  line_unit_price_changed: "Unit price changed",
  zero_price_reason_changed: "Zero-price reason changed",
};

export function auditEventLabel(eventType: AuditEventType): string {
  return LABELS[eventType] ?? eventType;
}

/** One-line summary for compact list UI. */
export function auditEventSummary(payload: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof payload.documentNumber === "string" && payload.documentNumber) {
    parts.push(payload.documentNumber);
  }

  if (payload.previousStatus != null && payload.newStatus != null) {
    parts.push(`${String(payload.previousStatus)} → ${String(payload.newStatus)}`);
  }

  if (typeof payload.cancelReasonCode === "string" && payload.cancelReasonCode) {
    parts.push(`Reason: ${payload.cancelReasonCode}`);
  }

  if (typeof payload.reversalReasonCode === "string" && payload.reversalReasonCode) {
    const rc = payload.reversalReasonCode as ReversalDocumentReasonCode;
    const rl =
      REVERSAL_DOCUMENT_REASON_LABELS[rc] ?? payload.reversalReasonCode;
    parts.push(`Reason: ${rl}`);
  }

  if (typeof payload.movementLineCount === "number") {
    parts.push(`${payload.movementLineCount} movement line(s)`);
  }

  if (typeof payload.linesTouched === "number") {
    parts.push(`${payload.linesTouched} line(s) updated`);
  }

  if (typeof payload.reservationsReleased === "number") {
    parts.push(`${payload.reservationsReleased} released`);
  }

  if (typeof payload.releasedRows === "number") {
    parts.push(`${payload.releasedRows} row(s) released`);
  }

  if (typeof payload.shrunkLines === "number" && payload.shrunkLines > 0) {
    parts.push(`${payload.shrunkLines} line(s) shrunk`);
  }

  if (typeof payload.consumedQty === "number") {
    parts.push(`consumed ${payload.consumedQty}`);
  }

  if (typeof payload.itemCode === "string" || typeof payload.itemId === "string") {
    const ic = typeof payload.itemCode === "string" ? payload.itemCode : String(payload.itemId ?? "");
    if (ic) parts.push(ic);
  }

  if (typeof payload.qty === "number") {
    parts.push(`qty ${payload.qty}`);
  }

  if (typeof payload.previousQty === "number" && typeof payload.newQty === "number") {
    parts.push(`qty ${payload.previousQty} → ${payload.newQty}`);
  }

  if (typeof payload.previousUnitPrice === "number" && typeof payload.newUnitPrice === "number") {
    parts.push(`price ${Number(payload.previousUnitPrice).toFixed(2)} → ${Number(payload.newUnitPrice).toFixed(2)}`);
  }

  if (typeof payload.unitPrice === "number") {
    parts.push(`@${Number(payload.unitPrice).toFixed(2)}`);
  }

  if (payload.previousReason != null || payload.newReason != null) {
    parts.push(`${String(payload.previousReason ?? "—")} → ${String(payload.newReason ?? "—")}`);
  }

  if (Array.isArray(payload.changedFields) && payload.changedFields.length > 0) {
    parts.push(`Fields: ${(payload.changedFields as string[]).join(", ")}`);
  }

  if (typeof payload.lineCount === "number") {
    parts.push(`${payload.lineCount} line(s)`);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}
