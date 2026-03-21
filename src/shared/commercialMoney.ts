/**
 * Central money rules for planning documents (PO/SO): configurable decimals (2–4), half-up rounding.
 * Line amount = round(qty * unitPrice); document total = round(sum of line amounts).
 */

import { clampMoneyDecimals } from "./settings/mergeNormalize";
import { getAppSettings } from "./settings/store";

/** Default when settings are not involved (docs / tests). */
export const COMMERCIAL_MONEY_DECIMAL_PLACES = 2;

export function getCommercialMoneyDecimalPlaces(): number {
  return clampMoneyDecimals(getAppSettings().commercial.moneyDecimalPlaces);
}

/** Round to configured commercial decimals (half away from zero). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const places = getCommercialMoneyDecimalPlaces();
  const factor = 10 ** places;
  const scaled = value * factor;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return rounded / factor;
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
 * Parse and normalize a unit price for persistence: finite, ≥ 0, rounded to commercial decimals.
 * Returns null if invalid (including negative).
 */
export function parseCommercialUnitPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}
