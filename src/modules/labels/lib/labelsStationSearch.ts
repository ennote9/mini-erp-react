import type { Item } from "@/modules/items/model";
import { itemRepository } from "@/modules/items/repository";

export type StationSearchResult =
  | { kind: "empty" }
  | { kind: "none" }
  | { kind: "one"; item: Item; barcodeId?: string }
  | { kind: "pickItem"; items: Item[] };

function normalizeBarcodeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

const MAX_TEXT_PICK = 20;

/**
 * Resolves a station search: exact barcode match first (active rows + legacy flat field), then `itemRepository.search`.
 */
export function findStationSearchResult(raw: string): StationSearchResult {
  const q = raw.trim();
  if (!q) return { kind: "empty" };

  const qNorm = normalizeBarcodeKey(q);
  const barcodeMatches: { item: Item; barcodeId?: string }[] = [];

  for (const item of itemRepository.list()) {
    let matched = false;
    for (const b of item.barcodes ?? []) {
      if (!b.isActive) continue;
      const v = normalizeBarcodeKey(b.codeValue);
      if (v && v === qNorm) {
        barcodeMatches.push({ item, barcodeId: b.id });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const leg = normalizeBarcodeKey(item.barcode ?? "");
    if (leg && leg === qNorm) {
      const primary =
        item.barcodes?.find((x) => x.isPrimary && x.isActive) ??
        item.barcodes?.find((x) => x.isActive);
      barcodeMatches.push({ item, barcodeId: primary?.id });
    }
  }

  const seen = new Set<string>();
  const uniq: { item: Item; barcodeId?: string }[] = [];
  for (const m of barcodeMatches) {
    if (seen.has(m.item.id)) continue;
    seen.add(m.item.id);
    uniq.push(m);
  }

  if (uniq.length === 1) {
    return { kind: "one", item: uniq[0].item, barcodeId: uniq[0].barcodeId };
  }
  if (uniq.length > 1) {
    return { kind: "pickItem", items: uniq.map((u) => u.item) };
  }

  const textHits = itemRepository.search(q);
  if (textHits.length === 0) return { kind: "none" };
  if (textHits.length === 1) return { kind: "one", item: textHits[0] };
  return { kind: "pickItem", items: textHits.slice(0, MAX_TEXT_PICK) };
}
