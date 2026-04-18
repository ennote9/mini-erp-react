/**
 * Item base price mutations and cross-module re-exports for effective pricing.
 */
import { itemRepository, flushPendingItemsPersist } from "./repository";
import type { ItemPriceReasonCode, ItemPriceType } from "./model";
import {
  applyNewPriceToItem,
  cancelScheduledRecord,
  getEffectiveItemBasePrice,
  isoNow,
  replaceScheduledPrice,
  todayYmdLocal,
  type ApplyNewPriceInput,
} from "./lib/itemPriceHistory";

export { getEffectiveItemBasePrice } from "./lib/itemPriceHistory";

export type ApplyItemPriceParams = {
  amount: number;
  validFromYmd: string;
  reasonCode: ItemPriceReasonCode;
  comment?: string;
  /** If true, cancel existing scheduled then apply (future price replace flow). */
  replaceScheduledConfirmed?: boolean;
};

export type ApplyItemPriceResult =
  | { success: true }
  | { success: false; error: string; needsReplaceScheduled?: boolean };

export function applyItemPrice(
  itemId: string,
  priceType: ItemPriceType,
  params: ApplyItemPriceParams,
): ApplyItemPriceResult {
  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const todayYmd = todayYmdLocal();
  const input: ApplyNewPriceInput = {
    priceType,
    amount: params.amount,
    validFromYmd: params.validFromYmd,
    reasonCode: params.reasonCode,
    comment: params.comment,
    todayYmd,
  };

  let result = applyNewPriceToItem(item, input);
  if (!result.ok && result.needsReplaceScheduled && params.replaceScheduledConfirmed) {
    result = replaceScheduledPrice(item, input, isoNow());
  }
  if (!result.ok) {
    if (result.error === "replace_scheduled_required") {
      return { success: false, error: "replace_scheduled_required", needsReplaceScheduled: true };
    }
    return { success: false, error: result.error };
  }
  itemRepository.update(itemId, {
    priceHistory: result.item.priceHistory,
    purchasePrice: result.item.purchasePrice,
    salePrice: result.item.salePrice,
  });
  return { success: true };
}

export async function applyItemPriceAwaitPersist(
  itemId: string,
  priceType: ItemPriceType,
  params: ApplyItemPriceParams,
): Promise<ApplyItemPriceResult> {
  const r = applyItemPrice(itemId, priceType, params);
  if (!r.success) return r;
  try {
    await flushPendingItemsPersist();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg || "persist_failed" };
  }
  return { success: true };
}

export type CancelScheduledPriceResult = { success: true } | { success: false; error: string };

export function cancelScheduledItemPrice(itemId: string, recordId: string): CancelScheduledPriceResult {
  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const next = cancelScheduledRecord(item, recordId, isoNow());
  itemRepository.update(itemId, {
    priceHistory: next.priceHistory,
    purchasePrice: next.purchasePrice,
    salePrice: next.salePrice,
  });
  return { success: true };
}

export async function cancelScheduledItemPriceAwaitPersist(
  itemId: string,
  recordId: string,
): Promise<CancelScheduledPriceResult> {
  const r = cancelScheduledItemPrice(itemId, recordId);
  if (!r.success) return r;
  try {
    await flushPendingItemsPersist();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
  return { success: true };
}

/** Effective base price for documents: `undefined` means treat as 0 in money fields. */
export function getEffectiveItemBasePriceOrZero(
  itemId: string,
  priceType: ItemPriceType,
  documentDateYmd: string,
): number {
  const item = itemRepository.getById(itemId);
  const v = getEffectiveItemBasePrice(item, priceType, documentDateYmd);
  return v ?? 0;
}
