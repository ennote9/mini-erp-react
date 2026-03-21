/**
 * Shared validation and normalization for document forms (e.g. PO, SO draft save).
 * Lightweight helpers to avoid duplication. User-facing error messages.
 */

import { normalizeTrim } from "./validation";
import { parseCommercialUnitPrice, roundMoney } from "./commercialMoney";
import { isZeroPriceLineReasonCode } from "./reasonCodes";
import { getAppSettings } from "./settings/store";

export type DocumentLineInput = { itemId: string; qty: number };

type ItemRepositoryLike = {
  getById(id: string): { isActive: boolean } | undefined;
};

/**
 * Parse and validate line qty: must be a positive integer.
 * Returns the number if valid, null otherwise.
 */
export function parseDocumentLineQty(qty: unknown): number | null {
  if (qty == null) return null;
  const n = typeof qty === "number" ? qty : parseInt(String(qty), 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * Normalize comment: trim; return undefined if empty.
 */
export function normalizeDocumentComment(comment: string | undefined): string | undefined {
  const t = normalizeTrim(comment);
  return t === "" ? undefined : t;
}

/**
 * Validate document lines (at least one line; each line has item + positive integer qty;
 * each item exists and is active; no duplicate items).
 * Uses itemRepository.getById to check existence and isActive.
 */
export function validateDocumentLines(
  lines: Array<{ itemId: string; qty: number }>,
  itemRepository: ItemRepositoryLike,
): string | null {
  if (!lines || lines.length === 0) return "At least one line is required.";
  const itemIds = new Set<string>();
  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    if (itemIdTrimmed === "") return "Each line must have an item.";
    const qty = parseDocumentLineQty(line.qty);
    if (qty === null) return "Quantity must be greater than zero.";
    const item = itemRepository.getById(itemIdTrimmed);
    if (!item) return "Each line must have an item.";
    if (!item.isActive) return "Selected item is inactive.";
    if (itemIds.has(itemIdTrimmed)) return "Duplicate items are not allowed in the same document.";
    itemIds.add(itemIdTrimmed);
  }
  return null;
}

/**
 * Validate unit price on each line (PO/SO draft save). Must parse as finite, ≥ 0 (after commercial rounding rules).
 */
export function validatePlanningLineUnitPrices(
  lines: ReadonlyArray<{ unitPrice?: unknown }>,
): string | null {
  if (!lines || lines.length === 0) return null;
  for (const line of lines) {
    if (parseCommercialUnitPrice(line.unitPrice) === null) {
      return "Each line must have a valid unit price (number ≥ 0).";
    }
  }
  return null;
}

/**
 * Lines with zero unit price (after commercial rules) must declare an explicit reason code.
 */
export function validatePlanningLinesZeroPriceReasons(
  lines: ReadonlyArray<{ unitPrice?: unknown; zeroPriceReasonCode?: unknown }>,
): string | null {
  if (!getAppSettings().commercial.zeroPriceLinesRequireReason) return null;
  if (!lines || lines.length === 0) return null;
  for (const line of lines) {
    const up = parseCommercialUnitPrice(line.unitPrice);
    if (up === null) continue;
    if (roundMoney(up) !== 0) continue;
    if (!isZeroPriceLineReasonCode(line.zeroPriceReasonCode)) {
      return "Each line with zero unit price must have a zero-price reason.";
    }
  }
  return null;
}

/**
 * Normalize lines for persist: trim itemId, ensure qty is positive integer.
 * Call after validation so qty is already valid.
 */
export function normalizeDocumentLines(
  lines: Array<{ itemId: string; qty: number }>,
): Array<{ itemId: string; qty: number }> {
  return lines.map((l) => ({
    itemId: normalizeTrim(l.itemId),
    qty: parseDocumentLineQty(l.qty) ?? 1,
  }));
}
