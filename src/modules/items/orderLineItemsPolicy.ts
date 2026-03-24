import type { Item } from "./model";
import { itemRepository } from "./repository";

/**
 * Items eligible for standard purchase/sales document lines.
 * Testers are excluded so operational ordering stays sellable-first; use master data to manage testers.
 */
export function listSellableItemsForDocumentLines(): Item[] {
  return itemRepository.list().filter((x) => x.itemKind === "SELLABLE");
}
