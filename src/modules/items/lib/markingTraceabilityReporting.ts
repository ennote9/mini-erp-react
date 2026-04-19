/**
 * Read-only aggregates and “needs attention” signals for marking codes.
 * Built on top of marking records + audit; does not mutate lifecycle.
 */
import type { ItemMarkingRecord, ItemMarkingRecordSource, ItemMarkingRecordStatus } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditEntry, ItemMarkingRecordAuditSource } from "../model/itemMarkingRecordAudit";
import { markingRecordAuditRepository } from "../markingRecordAuditRepository";
import { markingRecordRepository } from "../markingRecordRepository";
import { getMarkingRecordLastPrintAudit } from "../markingRecordService";

/** Default: RESERVED older than this (ms since last update) are flagged stale. */
export const MARKING_STALE_RESERVED_MS = 48 * 60 * 60 * 1000;

/** Default: PRINTED not confirmed as USED after this age are flagged. */
export const MARKING_STALE_PRINTED_MS = 7 * 24 * 60 * 60 * 1000;

/** Item is highlighted if it has at least this many VOID records. */
export const MARKING_HIGH_VOID_PER_ITEM_THRESHOLD = 5;

/** batchRef group highlighted if at least this many VOID records share the ref. */
export const MARKING_HIGH_VOID_PER_BATCH_THRESHOLD = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type MarkingStatusCounts = Record<ItemMarkingRecordStatus, number>;

export function countMarkingRecordsByStatus(records: readonly ItemMarkingRecord[]): MarkingStatusCounts {
  const c: MarkingStatusCounts = { AVAILABLE: 0, RESERVED: 0, PRINTED: 0, USED: 0, VOID: 0 };
  for (const r of records) c[r.status]++;
  return c;
}

export function countByKind(records: readonly ItemMarkingRecord[]): Map<ItemMarkingRecord["kind"], number> {
  const m = new Map<ItemMarkingRecord["kind"], number>();
  for (const r of records) {
    m.set(r.kind, (m.get(r.kind) ?? 0) + 1);
  }
  return m;
}

/** Per-item: total marking records and void count (for anomaly hints). */
export function buildVoidCountsByItemId(records: readonly ItemMarkingRecord[]): Map<string, { total: number; voids: number }> {
  const m = new Map<string, { total: number; voids: number }>();
  for (const r of records) {
    const cur = m.get(r.itemId) ?? { total: 0, voids: 0 };
    cur.total++;
    if (r.status === "VOID") cur.voids++;
    m.set(r.itemId, cur);
  }
  return m;
}

export function buildVoidCountsByBatchRef(records: readonly ItemMarkingRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    if (r.status !== "VOID") continue;
    const ref = (r.batchRef ?? "").trim();
    if (!ref) continue;
    m.set(ref, (m.get(ref) ?? 0) + 1);
  }
  return m;
}

export type MarkingProblemKind = "stale_reserved" | "stale_printed" | "high_void_item" | "high_void_batch";

export type MarkingProblemInfo = {
  kinds: MarkingProblemKind[];
  hasProblem: boolean;
};

export function computeMarkingProblems(
  record: ItemMarkingRecord,
  nowMs: number,
  voidByItem: Map<string, { total: number; voids: number }>,
  voidByBatchRef: Map<string, number>,
  opts?: {
    staleReservedMs?: number;
    stalePrintedMs?: number;
    highVoidItemThreshold?: number;
    highVoidBatchThreshold?: number;
  },
): MarkingProblemInfo {
  const staleReservedMs = opts?.staleReservedMs ?? MARKING_STALE_RESERVED_MS;
  const stalePrintedMs = opts?.stalePrintedMs ?? MARKING_STALE_PRINTED_MS;
  const highVoidItem = opts?.highVoidItemThreshold ?? MARKING_HIGH_VOID_PER_ITEM_THRESHOLD;
  const highVoidBatch = opts?.highVoidBatchThreshold ?? MARKING_HIGH_VOID_PER_BATCH_THRESHOLD;

  const kinds: MarkingProblemKind[] = [];
  const updated = Date.parse(record.updatedAt);

  if (record.status === "RESERVED" && Number.isFinite(updated) && nowMs - updated > staleReservedMs) {
    kinds.push("stale_reserved");
  }
  if (record.status === "PRINTED" && Number.isFinite(updated) && nowMs - updated > stalePrintedMs) {
    kinds.push("stale_printed");
  }

  const itemStats = voidByItem.get(record.itemId);
  if (itemStats && itemStats.voids >= highVoidItem) {
    kinds.push("high_void_item");
  }

  const batchRef = (record.batchRef ?? "").trim();
  if (batchRef && (voidByBatchRef.get(batchRef) ?? 0) >= highVoidBatch) {
    kinds.push("high_void_batch");
  }

  return { kinds: [...new Set(kinds)], hasProblem: kinds.length > 0 };
}

export function getLastAuditEntry(markingRecordId: string): ItemMarkingRecordAuditEntry | undefined {
  const list = markingRecordAuditRepository.listByMarkingRecordId(markingRecordId);
  return list.length ? list[list.length - 1] : undefined;
}

export function getFirstAuditEntry(markingRecordId: string): ItemMarkingRecordAuditEntry | undefined {
  const list = markingRecordAuditRepository.listByMarkingRecordId(markingRecordId);
  return list[0];
}

export type TraceabilityEnrichedRow = {
  record: ItemMarkingRecord;
  lastAudit: ItemMarkingRecordAuditEntry | undefined;
  lastPrintAudit: ItemMarkingRecordAuditEntry | undefined;
  firstAudit: ItemMarkingRecordAuditEntry | undefined;
  problems: MarkingProblemInfo;
};

export function buildTraceabilityRows(
  records: readonly ItemMarkingRecord[],
  nowMs: number,
  voidByItem: Map<string, { total: number; voids: number }>,
  voidByBatchRef: Map<string, number>,
): TraceabilityEnrichedRow[] {
  return records.map((record) => ({
    record,
    lastAudit: getLastAuditEntry(record.id),
    lastPrintAudit: getMarkingRecordLastPrintAudit(record.id),
    firstAudit: getFirstAuditEntry(record.id),
    problems: computeMarkingProblems(record, nowMs, voidByItem, voidByBatchRef),
  }));
}

/** Audit entries with toStatus in range [sinceIso, +∞). */
export function countAuditToStatusSince(
  toStatus: ItemMarkingRecordStatus,
  sinceIso: string,
): number {
  return countAuditToStatusSinceForRecords(toStatus, sinceIso, null);
}

/** When `recordIds` is set, only transitions for those marking records are counted. */
export function countAuditToStatusSinceForRecords(
  toStatus: ItemMarkingRecordStatus,
  sinceIso: string,
  recordIds: ReadonlySet<string> | null,
): number {
  let n = 0;
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return 0;
  for (const e of markingRecordAuditRepository.list()) {
    if (recordIds && !recordIds.has(e.markingRecordId)) continue;
    if (e.toStatus !== toStatus) continue;
    const t = Date.parse(e.createdAt);
    if (Number.isFinite(t) && t >= since) n++;
  }
  return n;
}

export function countTransitionsByPrintSource(): Partial<Record<ItemMarkingRecordAuditSource, number>> {
  const acc: Partial<Record<ItemMarkingRecordAuditSource, number>> = {};
  for (const e of markingRecordAuditRepository.list()) {
    const s = e.source;
    acc[s] = (acc[s] ?? 0) + 1;
  }
  return acc;
}

export type MarkingTraceabilityMetrics = {
  totalRecords: number;
  printedNotUsed: number;
  reservedStale: number;
  printedStale: number;
  voidLast7Days: number;
  usedLast7Days: number;
  usedRatio: number;
  voidRatio: number;
};

export function computeTraceabilityMetrics(
  records: readonly ItemMarkingRecord[],
  nowMs: number,
  opts?: { staleReservedMs?: number; stalePrintedMs?: number; auditRecordIds?: ReadonlySet<string> | null },
): MarkingTraceabilityMetrics {
  const staleReservedMs = opts?.staleReservedMs ?? MARKING_STALE_RESERVED_MS;
  const stalePrintedMs = opts?.stalePrintedMs ?? MARKING_STALE_PRINTED_MS;
  const since7d = new Date(nowMs - 7 * MS_PER_DAY).toISOString();
  const auditScope = opts?.auditRecordIds ?? null;

  let printedNotUsed = 0;
  let reservedStale = 0;
  let printedStale = 0;

  for (const r of records) {
    if (r.status === "PRINTED") printedNotUsed++;
    const updated = Date.parse(r.updatedAt);
    if (!Number.isFinite(updated)) continue;
    if (r.status === "RESERVED" && nowMs - updated > staleReservedMs) reservedStale++;
    if (r.status === "PRINTED" && nowMs - updated > stalePrintedMs) printedStale++;
  }

  const voidLast7Days = countAuditToStatusSinceForRecords("VOID", since7d, auditScope);
  const usedLast7Days = countAuditToStatusSinceForRecords("USED", since7d, auditScope);
  const total = records.length || 1;
  const voidTotal = records.filter((r) => r.status === "VOID").length;
  const usedTotal = records.filter((r) => r.status === "USED").length;

  return {
    totalRecords: records.length,
    printedNotUsed,
    reservedStale,
    printedStale,
    voidLast7Days,
    usedLast7Days,
    usedRatio: usedTotal / total,
    voidRatio: voidTotal / total,
  };
}

export function listAllMarkingRecordsForReporting(): ItemMarkingRecord[] {
  return markingRecordRepository.list();
}

export function countByItemId(records: readonly ItemMarkingRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) m.set(r.itemId, (m.get(r.itemId) ?? 0) + 1);
  return m;
}

export function countByBatchRef(records: readonly ItemMarkingRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    const ref = (r.batchRef ?? "").trim();
    if (!ref) continue;
    m.set(ref, (m.get(ref) ?? 0) + 1);
  }
  return m;
}

export function countByRecordSource(records: readonly ItemMarkingRecord[]): Partial<Record<ItemMarkingRecordSource, number>> {
  const acc: Partial<Record<ItemMarkingRecordSource, number>> = {};
  for (const r of records) {
    const s = r.source ?? "OTHER";
    acc[s] = (acc[s] ?? 0) + 1;
  }
  return acc;
}
