/**
 * Payment terms and due date helpers for planning documents (PO/SO).
 *
 * Due date rule:
 * - If paymentTermsDays is undefined / omitted (empty form): dueDate is undefined (not computed).
 * - If paymentTermsDays is 0: dueDate equals document date (same calendar day).
 * - If paymentTermsDays is a positive integer: dueDate = document local calendar date + N days.
 * - Invalid/missing document date: dueDate undefined.
 */

import { normalizeTrim } from "./validation";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validatePaymentTermsDaysForm(value: string | undefined): string | null {
  const t = normalizeTrim(value ?? "");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) {
    return "Payment terms must be a whole number of days ≥ 0, or leave empty.";
  }
  return null;
}

/** Empty string → undefined (no terms). Valid integer string → days. */
export function parsePaymentTermsDaysToStore(value: string | undefined): number | undefined {
  const t = normalizeTrim(value ?? "");
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

export function computePlanningDueDate(
  documentDateYYYYMMDD: string,
  paymentTermsDays: number | undefined,
): string | undefined {
  if (paymentTermsDays === undefined) return undefined;
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0) return undefined;
  const trimmed = normalizeTrim(documentDateYYYYMMDD);
  const m = trimmed.match(YMD);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  dt.setDate(dt.getDate() + paymentTermsDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
