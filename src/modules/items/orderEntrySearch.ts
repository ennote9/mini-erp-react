import type { Item } from "./model";

/**
 * Ranks items for order-line entry search.
 * Order: exact code → exact barcode → startsWith code → startsWith name → partial name.
 */
export function searchItemsForOrderEntry(
  items: Item[],
  query: string,
): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exactCode: Item[] = [];
  const exactBarcode: Item[] = [];
  const startsWithCode: Item[] = [];
  const startsWithName: Item[] = [];
  const partialName: Item[] = [];

  for (const item of items) {
    const code = item.code.toLowerCase();
    const name = item.name.toLowerCase();
    const barcodes = (item.barcodes ?? []).map((b) => b.codeValue.toLowerCase());
    const legacyBarcode = (item.barcode ?? "").toLowerCase();

    if (code === q) {
      exactCode.push(item);
      continue;
    }
    if (barcodes.some((x) => x === q) || (legacyBarcode !== "" && legacyBarcode === q)) {
      exactBarcode.push(item);
      continue;
    }
    if (code.startsWith(q)) {
      startsWithCode.push(item);
      continue;
    }
    if (name.startsWith(q)) {
      startsWithName.push(item);
      continue;
    }
    if (name.includes(q)) {
      partialName.push(item);
    }
  }

  return [
    ...exactCode,
    ...exactBarcode,
    ...startsWithCode,
    ...startsWithName,
    ...partialName,
  ];
}
