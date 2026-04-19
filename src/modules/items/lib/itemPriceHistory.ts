/**
 * Domain logic for item base price history (v1).
 * Pure helpers — no React, no repository side effects.
 */
import type { Item, ItemPriceRecord, ItemPriceReasonCode, ItemPriceType } from "../model";

export type ComputedPriceStatus = "active" | "scheduled" | "superseded" | "cancelled";

export function compareYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function yesterdayYmd(fromYmd: string): string {
  return addDaysYmd(fromYmd, -1);
}

/** Calendar "today" in local timezone as YYYY-MM-DD. */
export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function newPriceRecordId(): string {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function recordsForType(item: Item, priceType: ItemPriceType): ItemPriceRecord[] {
  return (item.priceHistory ?? []).filter((r) => r.priceType === priceType);
}

/**
 * Descending chronology for price history (newest first): newer `validFrom` first;
 * when `validFrom` ties, newer `createdAt` first. Matches the history table sort.
 */
export function comparePriceHistoryChronologyDesc(a: ItemPriceRecord, b: ItemPriceRecord): number {
  const c = compareYmd(b.validFrom, a.validFrom);
  if (c !== 0) return c;
  return compareYmd(b.createdAt, a.createdAt);
}

export function sortPriceHistoryRecordsDesc(records: ItemPriceRecord[]): ItemPriceRecord[] {
  return [...records].sort(comparePriceHistoryChronologyDesc);
}

/** Non-cancelled rows of this type that have started on or before {@link asOfYmd}, newest first. */
export function getPriceHistoryChainStartedOnOrBefore(
  item: Item,
  priceType: ItemPriceType,
  asOfYmd: string,
): ItemPriceRecord[] {
  const records = recordsForType(item, priceType).filter(
    (r) => !r.cancelledAt && compareYmd(r.validFrom, asOfYmd) <= 0,
  );
  return sortPriceHistoryRecordsDesc(records);
}

/** Effective base price on a calendar date, or undefined if none applies. */
export function getEffectiveItemBasePrice(
  item: Item | undefined,
  priceType: ItemPriceType,
  dateYmd: string,
): number | undefined {
  if (!item) return undefined;
  const records = (item.priceHistory ?? []).filter((r) => r.priceType === priceType && !r.cancelledAt);
  const candidates = records.filter(
    (r) => compareYmd(r.validFrom, dateYmd) <= 0 && (!r.validTo || compareYmd(r.validTo, dateYmd) >= 0),
  );
  if (candidates.length === 0) return undefined;
  candidates.sort(comparePriceHistoryChronologyDesc);
  return candidates[0].amount;
}

export function getCurrentActiveRecord(
  item: Item,
  priceType: ItemPriceType,
  asOfYmd: string,
): ItemPriceRecord | undefined {
  const records = recordsForType(item, priceType).filter((r) => !r.cancelledAt);
  const actives = records.filter(
    (r) =>
      compareYmd(r.validFrom, asOfYmd) <= 0 && (!r.validTo || compareYmd(r.validTo, asOfYmd) >= 0),
  );
  if (actives.length === 0) return undefined;
  actives.sort(comparePriceHistoryChronologyDesc);
  return actives[0];
}

export function getNextScheduledRecord(
  item: Item,
  priceType: ItemPriceType,
  asOfYmd: string,
): ItemPriceRecord | undefined {
  const records = recordsForType(item, priceType).filter((r) => !r.cancelledAt);
  const future = records.filter((r) => compareYmd(r.validFrom, asOfYmd) > 0);
  future.sort((a, b) => compareYmd(a.validFrom, b.validFrom));
  return future[0];
}

export function computePriceRecordStatus(record: ItemPriceRecord, asOfYmd: string): ComputedPriceStatus {
  if (record.cancelledAt) return "cancelled";
  if (compareYmd(record.validFrom, asOfYmd) > 0) return "scheduled";
  if (record.validTo && compareYmd(record.validTo, asOfYmd) < 0) return "superseded";
  return "active";
}

export type PriceHistoryRow = ItemPriceRecord & { status: ComputedPriceStatus };

export function buildPriceHistoryRows(item: Item, asOfYmd: string): PriceHistoryRow[] {
  const list = [...(item.priceHistory ?? [])];
  return list
    .map((r) => ({ ...r, status: computePriceRecordStatus(r, asOfYmd) }))
    .sort(comparePriceHistoryChronologyDesc);
}

export function syncItemPriceSnapshotsFromHistory(item: Item, asOfYmd: string): Item {
  const p = getEffectiveItemBasePrice(item, "purchase", asOfYmd);
  const s = getEffectiveItemBasePrice(item, "sale", asOfYmd);
  return {
    ...item,
    purchasePrice: p,
    salePrice: s,
  };
}

/** Legacy migration: seed history from flat prices once. */
export function migrateLegacyFlatPricesToHistory(item: Item, migrationDateYmd: string, createdAtIso: string): Item {
  const history: ItemPriceRecord[] = [...(item.priceHistory ?? [])];
  const hasPurchase = history.some((r) => r.priceType === "purchase");
  const hasSale = history.some((r) => r.priceType === "sale");

  if (!hasPurchase && item.purchasePrice !== undefined && Number.isFinite(item.purchasePrice)) {
    history.push({
      id: `${item.id}-mig-purchase`,
      itemId: item.id,
      priceType: "purchase",
      amount: item.purchasePrice,
      validFrom: migrationDateYmd,
      reasonCode: "initial_migration",
      createdAt: createdAtIso,
    });
  }
  if (!hasSale && item.salePrice !== undefined && Number.isFinite(item.salePrice)) {
    history.push({
      id: `${item.id}-mig-sale`,
      itemId: item.id,
      priceType: "sale",
      amount: item.salePrice,
      validFrom: migrationDateYmd,
      reasonCode: "initial_migration",
      createdAt: createdAtIso,
    });
  }
  if (history.length === (item.priceHistory ?? []).length) return item;
  let next: Item = { ...item, priceHistory: history };
  next = syncItemPriceSnapshotsFromHistory(next, migrationDateYmd);
  return next;
}

export type ApplyNewPriceInput = {
  priceType: ItemPriceType;
  amount: number;
  validFromYmd: string;
  reasonCode: ItemPriceReasonCode;
  comment?: string;
  todayYmd: string;
};

export type ApplyNewPriceResult =
  | { ok: true; item: Item }
  | { ok: false; error: string; needsReplaceScheduled?: boolean };

/**
 * Validates and applies a new price record.
 * If a scheduled row already exists for this price type and the new row is future-dated,
 * returns `replace_scheduled_required` — use {@link replaceScheduledPrice} after user confirms.
 */
export function applyNewPriceToItem(item: Item, input: ApplyNewPriceInput): ApplyNewPriceResult {
  const { priceType, amount, validFromYmd, reasonCode, comment, todayYmd } = input;
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "invalid_amount" };
  if (compareYmd(validFromYmd, todayYmd) < 0) return { ok: false, error: "past_date" };
  if (!reasonCode) return { ok: false, error: "reason_required" };

  const isFuture = compareYmd(validFromYmd, todayYmd) > 0;
  const existingScheduled = getNextScheduledRecord(item, priceType, todayYmd);
  if (isFuture && existingScheduled) {
    return { ok: false, error: "replace_scheduled_required", needsReplaceScheduled: true };
  }

  let history: ItemPriceRecord[] = [...(item.priceHistory ?? [])];
  const newId = newPriceRecordId();
  const createdAt = isoNow();

  if (!isFuture) {
    const active = getCurrentActiveRecord(item, priceType, todayYmd);
    if (active) {
      history = history.map((r) =>
        r.id === active.id ? { ...r, validTo: yesterdayYmd(todayYmd) } : r,
      );
    }
  }

  history.push({
    id: newId,
    itemId: item.id,
    priceType,
    amount,
    validFrom: validFromYmd,
    reasonCode,
    comment: comment?.trim() || undefined,
    createdAt,
  });

  let next: Item = { ...item, priceHistory: history };
  next = syncItemPriceSnapshotsFromHistory(next, todayYmd);
  return { ok: true, item: next };
}

/**
 * Replace flow: cancel existing scheduled then add new future price (caller combines in one transaction).
 */
export function cancelScheduledRecord(item: Item, recordId: string, cancelledAtIso: string): Item {
  const history = (item.priceHistory ?? []).map((r) =>
    r.id === recordId ? { ...r, cancelledAt: cancelledAtIso } : r,
  );
  let next: Item = { ...item, priceHistory: history };
  next = syncItemPriceSnapshotsFromHistory(next, todayYmdLocal());
  return next;
}

export function replaceScheduledPrice(
  item: Item,
  input: ApplyNewPriceInput,
  cancelledAtIso: string,
): ApplyNewPriceResult {
  const scheduled = getNextScheduledRecord(item, input.priceType, input.todayYmd);
  if (!scheduled) return applyNewPriceToItem(item, input);
  let next = cancelScheduledRecord(item, scheduled.id, cancelledAtIso);
  return applyNewPriceToItem(next, input);
}

/**
 * The row immediately before {@link current} in real chronology (newest first within the same type):
 * same chain as {@link getPriceHistoryChainStartedOnOrBefore}, next older entry.
 * Correct when multiple edits share the same `validFrom` (uses `createdAt` tie-break).
 */
export function getPreviousActiveRecord(
  item: Item,
  priceType: ItemPriceType,
  current: ItemPriceRecord,
  asOfYmd: string,
): ItemPriceRecord | undefined {
  const chain = getPriceHistoryChainStartedOnOrBefore(item, priceType, asOfYmd);
  const idx = chain.findIndex((r) => r.id === current.id);
  if (idx === -1 || idx >= chain.length - 1) return undefined;
  return chain[idx + 1];
}

/** Last {@link n} historical amounts (newest {@link n} in real chronology), oldest → newest for sparklines. */
export function getLastNHistoricalPriceAmounts(
  item: Item,
  priceType: ItemPriceType,
  asOfYmd: string,
  n: number,
): number[] {
  const chain = getPriceHistoryChainStartedOnOrBefore(item, priceType, asOfYmd);
  const newestFirst = chain.slice(0, Math.min(n, chain.length));
  return [...newestFirst].reverse().map((r) => r.amount);
}

export type PriceDeltaVsPrevious = {
  delta: number;
  direction: "up" | "down" | "same";
};

export function computeDeltaVsPrevious(
  currentAmount: number,
  previousAmount: number | undefined,
): PriceDeltaVsPrevious | null {
  if (previousAmount === undefined || !Number.isFinite(previousAmount)) return null;
  const delta = currentAmount - previousAmount;
  if (Math.abs(delta) < 1e-9) return { delta: 0, direction: "same" };
  return { delta, direction: delta > 0 ? "up" : "down" };
}
