import type { TFunction } from "./resolve";
import type { ReversalDocumentReasonCode } from "@/shared/reasonCodes";
import { translateCancelReason, translateReversalReason } from "./reasonLabels";
import { isCancelDocumentReasonCode, isReversalDocumentReasonCode } from "@/shared/reasonCodes";

/** Localized one-line audit payload summary (UI). */
export function auditEventSummaryI18n(payload: Record<string, unknown>, t: TFunction): string {
  const parts: string[] = [];

  if (typeof payload.documentNumber === "string" && payload.documentNumber) {
    parts.push(payload.documentNumber);
  }

  if (payload.previousStatus != null && payload.newStatus != null) {
    parts.push(`${String(payload.previousStatus)} → ${String(payload.newStatus)}`);
  }

  if (typeof payload.cancelReasonCode === "string" && payload.cancelReasonCode) {
    const c = payload.cancelReasonCode;
    const label = isCancelDocumentReasonCode(c) ? translateCancelReason(t, c) : c;
    parts.push(t("domain.audit.summary.reasonPrefix", { text: label }));
  }

  if (typeof payload.reversalReasonCode === "string" && payload.reversalReasonCode) {
    const rc = payload.reversalReasonCode;
    const label = isReversalDocumentReasonCode(rc)
      ? translateReversalReason(t, rc as ReversalDocumentReasonCode)
      : rc;
    parts.push(t("domain.audit.summary.reasonPrefix", { text: label }));
  }

  if (typeof payload.movementLineCount === "number") {
    parts.push(t("domain.audit.summary.movementLines", { count: String(payload.movementLineCount) }));
  }

  if (typeof payload.linesTouched === "number") {
    parts.push(t("domain.audit.summary.linesUpdated", { count: String(payload.linesTouched) }));
  }

  if (typeof payload.reservationsReleased === "number") {
    parts.push(t("domain.audit.summary.released", { count: String(payload.reservationsReleased) }));
  }

  if (typeof payload.releasedRows === "number") {
    parts.push(t("domain.audit.summary.rowsReleased", { count: String(payload.releasedRows) }));
  }

  if (typeof payload.shrunkLines === "number" && payload.shrunkLines > 0) {
    parts.push(t("domain.audit.summary.linesShrunk", { count: String(payload.shrunkLines) }));
  }

  if (typeof payload.consumedQty === "number") {
    parts.push(t("domain.audit.summary.consumed", { qty: String(payload.consumedQty) }));
  }

  if (typeof payload.itemCode === "string" || typeof payload.itemId === "string") {
    const ic = typeof payload.itemCode === "string" ? payload.itemCode : String(payload.itemId ?? "");
    if (ic) parts.push(ic);
  }

  if (typeof payload.qty === "number") {
    parts.push(t("domain.audit.summary.qty", { q: String(payload.qty) }));
  }

  if (typeof payload.previousQty === "number" && typeof payload.newQty === "number") {
    parts.push(
      t("domain.audit.summary.qtyArrow", {
        a: String(payload.previousQty),
        b: String(payload.newQty),
      }),
    );
  }

  if (typeof payload.previousUnitPrice === "number" && typeof payload.newUnitPrice === "number") {
    parts.push(
      t("domain.audit.summary.priceArrow", {
        a: Number(payload.previousUnitPrice).toFixed(2),
        b: Number(payload.newUnitPrice).toFixed(2),
      }),
    );
  }

  if (typeof payload.unitPrice === "number") {
    parts.push(t("domain.audit.summary.atPrice", { p: Number(payload.unitPrice).toFixed(2) }));
  }

  if (payload.previousReason != null || payload.newReason != null) {
    const dash = t("domain.audit.summary.emDash");
    parts.push(`${String(payload.previousReason ?? dash)} → ${String(payload.newReason ?? dash)}`);
  }

  if (Array.isArray(payload.changedFields) && payload.changedFields.length > 0) {
    parts.push(
      t("domain.audit.summary.fields", { list: (payload.changedFields as string[]).join(", ") }),
    );
  }

  if (typeof payload.lineCount === "number") {
    parts.push(t("domain.audit.summary.lineCount", { count: String(payload.lineCount) }));
  }

  return parts.length > 0 ? parts.join(" · ") : t("domain.audit.summary.empty");
}
