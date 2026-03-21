/**
 * Central money rules for planning documents (PO/SO): 2 decimal places, half-up rounding.
 * Line amount = round2(qty * unitPrice); document total = round2(sum of line amounts).
 */

export const COMMERCIAL_MONEY_DECIMAL_PLACES = 2;

const FACTOR = 10 ** COMMERCIAL_MONEY_DECIMAL_PLACES;

/** Round to 2 decimals (half away from zero). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = value * FACTOR;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return rounded / FACTOR;
}

/** Per-line monetary amount from qty and unit price (each already validated as finite, unit price ≥ 0). */
export function lineAmountMoney(qty: number, unitPrice: number): number {
  return roundMoney(qty * unitPrice);
}

/** Sum of line amounts, rounded once at the end to match displayed line totals. */
export function sumPlanningDocumentLineAmounts(
  lines: ReadonlyArray<{ qty: number; unitPrice: number }>,
): number {
  let sum = 0;
  for (const l of lines) {
    const q = typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
    const p = typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
    sum += lineAmountMoney(q, p);
  }
  return roundMoney(sum);
}

/**
 * Parse and normalize a unit price for persistence: finite, ≥ 0, rounded to 2 decimals.
 * Returns null if invalid (including negative).
 */
export function parseCommercialUnitPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}
