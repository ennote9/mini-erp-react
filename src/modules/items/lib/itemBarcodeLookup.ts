import type { Item } from "../model";
import { normalizeTrim } from "@/shared/validation";

/**
 * Tokens for **master** item list search: every stored barcode row (active or inactive) plus legacy `item.barcode`
 * when it is not redundant with a row value.
 */
export function itemBarcodeTokensForMasterSearch(item: Item): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const b of item.barcodes ?? []) {
    const v = normalizeTrim(b.codeValue);
    if (!v) continue;
    const low = v.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(low);
  }
  const leg = normalizeTrim(item.barcode ?? "");
  if (leg) {
    const low = leg.toLowerCase();
    if (!seen.has(low)) {
      seen.add(low);
      out.push(low);
    }
  }
  return out;
}

/**
 * Tokens for **operational** resolution (SO/PO line entry, batch paste, Excel import):
 * **active** structured barcodes only, plus legacy `item.barcode` when it adds a value not already covered
 * by an active row (unmigrated / edge cases).
 */
export function itemBarcodeTokensForOperationalLookup(item: Item): string[] {
  const out: string[] = [];
  const seenLower = new Set<string>();
  for (const b of item.barcodes ?? []) {
    if (!b.isActive) continue;
    const v = normalizeTrim(b.codeValue);
    if (!v) continue;
    const low = v.toLowerCase();
    if (seenLower.has(low)) continue;
    seenLower.add(low);
    out.push(v);
  }
  const leg = normalizeTrim(item.barcode ?? "");
  if (leg) {
    const low = leg.toLowerCase();
    if (!seenLower.has(low)) {
      seenLower.add(low);
      out.push(leg);
    }
  }
  return out;
}
