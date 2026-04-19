import type {
  ItemMarkingRecord,
  ItemMarkingRecordKind,
  ItemMarkingRecordSource,
  ItemMarkingRecordStatus,
} from "./model/itemMarkingRecord";
import type { ItemMarkingRecordAuditEntry, ItemMarkingRecordAuditSource } from "./model/itemMarkingRecordAudit";
import { markingRecordAuditRepository } from "./markingRecordAuditRepository";
import { markingRecordRepository, type CreateItemMarkingRecordInput } from "./markingRecordRepository";

export function listMarkingRecordsByItem(itemId: string): ItemMarkingRecord[] {
  return markingRecordRepository.listByItemId(itemId);
}

/** True when the record may be chosen for label preview / print (excludes consumed and void). */
export function isMarkingRecordSelectableForPrinting(r: ItemMarkingRecord): boolean {
  return r.status === "AVAILABLE" || r.status === "RESERVED" || r.status === "PRINTED";
}

/** Codes that can be selected for printing / preview. */
export function listSelectableMarkingRecordsForItem(itemId: string): ItemMarkingRecord[] {
  return listMarkingRecordsByItem(itemId).filter(isMarkingRecordSelectableForPrinting);
}

export function getMarkingRecordById(id: string): ItemMarkingRecord | undefined {
  return markingRecordRepository.getById(id);
}

export function listMarkingRecordAuditByRecordId(markingRecordId: string, limit = 40): ItemMarkingRecordAuditEntry[] {
  return markingRecordAuditRepository.listByMarkingRecordId(markingRecordId).slice(-limit);
}

/** Latest audit row that moved this record to PRINTED with a print job id (for reconciliation traceability). */
export function getMarkingRecordLastPrintAudit(markingRecordId: string): ItemMarkingRecordAuditEntry | undefined {
  const entries = markingRecordAuditRepository.listByMarkingRecordId(markingRecordId);
  const prints = entries.filter((e) => e.toStatus === "PRINTED" && e.printJobId);
  return prints.length ? prints[prints.length - 1] : undefined;
}

export function listMarkingRecordIdsByPrintJobId(printJobId: string): string[] {
  return markingRecordAuditRepository.listMarkingRecordIdsByPrintJobId(printJobId);
}

export type ReconciliationBatchResult = {
  updated: number;
  skipped: number;
  notApplicable: number;
};

/** PRINTED → USED; audit reason `reconciliation_used`. */
export function reconcileBatchConfirmUsed(ids: readonly string[], note?: string): ReconciliationBatchResult {
  const result: ReconciliationBatchResult = { updated: 0, skipped: 0, notApplicable: 0 };
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const r = getMarkingRecordById(id);
    if (!r) {
      result.skipped++;
      continue;
    }
    if (r.status !== "PRINTED") {
      result.notApplicable++;
      continue;
    }
    const u = markMarkingRecordUsed(id, { source: "reconciliation", reason: "reconciliation_used", note });
    if (u) result.updated++;
    else result.skipped++;
  }
  return result;
}

/** RESERVED → AVAILABLE; audit reason `reconciliation_release`. Does not move PRINTED → AVAILABLE. */
export function reconcileBatchReleaseToAvailable(ids: readonly string[], note?: string): ReconciliationBatchResult {
  const result: ReconciliationBatchResult = { updated: 0, skipped: 0, notApplicable: 0 };
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const r = getMarkingRecordById(id);
    if (!r) {
      result.skipped++;
      continue;
    }
    if (r.status !== "RESERVED") {
      result.notApplicable++;
      continue;
    }
    const u = releaseReservedMarking(id, { source: "reconciliation", reason: "reconciliation_release", note });
    if (u) result.updated++;
    else result.skipped++;
  }
  return result;
}

/** RESERVED or PRINTED → VOID; audit reason `reconciliation_void`. */
export function reconcileBatchVoid(ids: readonly string[], note?: string): ReconciliationBatchResult {
  const result: ReconciliationBatchResult = { updated: 0, skipped: 0, notApplicable: 0 };
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const r = getMarkingRecordById(id);
    if (!r) {
      result.skipped++;
      continue;
    }
    if (r.status !== "RESERVED" && r.status !== "PRINTED") {
      result.notApplicable++;
      continue;
    }
    const u = voidMarkingRecord(id, { source: "reconciliation", reason: "reconciliation_void", note });
    if (u) result.updated++;
    else result.skipped++;
  }
  return result;
}

function appendAudit(input: Omit<ItemMarkingRecordAuditEntry, "id" | "createdAt">): void {
  markingRecordAuditRepository.append(input);
}

export function canTransitionMarkingStatus(from: ItemMarkingRecordStatus, to: ItemMarkingRecordStatus): boolean {
  if (from === to) return true;
  if (from === "USED" || from === "VOID") return false;
  switch (from) {
    case "AVAILABLE":
      return to === "RESERVED" || to === "PRINTED" || to === "VOID";
    case "RESERVED":
      return to === "AVAILABLE" || to === "PRINTED" || to === "VOID";
    case "PRINTED":
      return to === "USED" || to === "VOID";
    default:
      return false;
  }
}

export type MarkingTransitionMeta = {
  source: ItemMarkingRecordAuditSource;
  reason: string;
  printJobId?: string;
  note?: string;
};

/**
 * Single entry point for status changes that require audit (except idempotent PRINTED→PRINTED).
 */
export function transitionMarkingRecordStatus(
  id: string,
  to: ItemMarkingRecordStatus,
  meta: MarkingTransitionMeta,
): ItemMarkingRecord | undefined {
  const r = markingRecordRepository.getById(id);
  if (!r) return undefined;
  if (r.status === to) {
    return r;
  }
  if (!canTransitionMarkingStatus(r.status, to)) return undefined;
  const fromStatus = r.status;
  const updated = markingRecordRepository.update(id, { status: to });
  if (updated) {
    appendAudit({
      markingRecordId: id,
      itemId: r.itemId,
      fromStatus,
      toStatus: to,
      reason: meta.reason,
      source: meta.source,
      printJobId: meta.printJobId,
      note: meta.note,
    });
  }
  return updated;
}

export function createMarkingRecord(input: CreateItemMarkingRecordInput): ItemMarkingRecord {
  const created = markingRecordRepository.create(input);
  appendAudit({
    markingRecordId: created.id,
    itemId: created.itemId,
    fromStatus: null,
    toStatus: created.status,
    reason: "create",
    source: input.source === "IMPORT" ? "import" : "manual",
  });
  return created;
}

export function importMarkingPoolBatch(
  entries: Array<{
    itemId: string;
    kind: ItemMarkingRecordKind;
    payload: string;
    humanLabel?: string;
    serial?: string;
    batchRef?: string;
    source?: ItemMarkingRecordSource;
    note?: string;
  }>,
): { created: number } {
  let created = 0;
  for (const e of entries) {
    createMarkingRecord({
      itemId: e.itemId,
      kind: e.kind,
      payload: e.payload,
      humanLabel: e.humanLabel,
      serial: e.serial,
      batchRef: e.batchRef,
      source: e.source ?? "IMPORT",
      status: "AVAILABLE",
      note: e.note,
    });
    created++;
  }
  return { created };
}

export function removeMarkingRecord(id: string): boolean {
  return markingRecordRepository.remove(id);
}

export function patchMarkingRecord(
  id: string,
  patch: Partial<Pick<ItemMarkingRecord, "payload" | "humanLabel" | "kind" | "note" | "batchRef" | "serial" | "source">>,
): ItemMarkingRecord | undefined {
  return markingRecordRepository.update(id, patch);
}

export function reserveMarkingRecord(
  id: string,
  meta: { source: ItemMarkingRecordAuditSource; reason?: string; printJobId?: string; note?: string },
): ItemMarkingRecord | undefined {
  return transitionMarkingRecordStatus(id, "RESERVED", {
    source: meta.source,
    reason: meta.reason ?? "reserve",
    printJobId: meta.printJobId,
    note: meta.note,
  });
}

export function releaseReservedMarking(
  id: string,
  meta?: { source?: ItemMarkingRecordAuditSource; reason?: string; note?: string },
): ItemMarkingRecord | undefined {
  return transitionMarkingRecordStatus(id, "AVAILABLE", {
    source: meta?.source ?? "release",
    reason: meta?.reason ?? "release",
    note: meta?.note,
  });
}

export function reserveNextAvailableMarking(
  itemId: string,
  kind: ItemMarkingRecordKind,
  meta?: { source?: ItemMarkingRecordAuditSource },
): ItemMarkingRecord | undefined {
  const candidates = markingRecordRepository
    .listByItemId(itemId)
    .filter((r) => r.kind === kind && r.status === "AVAILABLE")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pick = candidates[0];
  if (!pick) return undefined;
  return reserveMarkingRecord(pick.id, {
    source: meta?.source ?? "system",
    reason: "reserve_next_available",
  });
}

export function markMarkingRecordPrinted(
  id: string,
  meta?: { source?: ItemMarkingRecordAuditSource; reason?: string; printJobId?: string; note?: string },
): ItemMarkingRecord | undefined {
  const r = markingRecordRepository.getById(id);
  if (!r) return undefined;
  if (r.status === "PRINTED") {
    return r;
  }
  return transitionMarkingRecordStatus(id, "PRINTED", {
    source: meta?.source ?? "system",
    reason: meta?.reason ?? "printed",
    printJobId: meta?.printJobId,
    note: meta?.note,
  });
}

export function markManyMarkingRecordsPrinted(
  ids: readonly string[],
  opts: { printJobId?: string; source: ItemMarkingRecordAuditSource },
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    markMarkingRecordPrinted(id, {
      printJobId: opts.printJobId,
      source: opts.source,
      reason: "print_success",
    });
  }
}

export function markMarkingRecordUsed(
  id: string,
  meta?: { source?: ItemMarkingRecordAuditSource; note?: string; reason?: string },
): ItemMarkingRecord | undefined {
  return transitionMarkingRecordStatus(id, "USED", {
    source: meta?.source ?? "manual",
    reason: meta?.reason ?? "mark_used",
    note: meta?.note,
  });
}

export function voidMarkingRecord(
  id: string,
  meta?: { source?: ItemMarkingRecordAuditSource; note?: string; reason?: string },
): ItemMarkingRecord | undefined {
  return transitionMarkingRecordStatus(id, "VOID", {
    source: meta?.source ?? "void",
    reason: meta?.reason ?? "void",
    note: meta?.note,
  });
}

/** Reserve AVAILABLE → RESERVED before print/PDF; release on abort only if this call performed the reserve. */
export function beginMarkingPrintSession(
  markingRecordId: string | undefined,
  source: ItemMarkingRecordAuditSource,
): { releaseOnAbort: boolean } {
  if (!markingRecordId) return { releaseOnAbort: false };
  const r = getMarkingRecordById(markingRecordId);
  if (!r) return { releaseOnAbort: false };
  if (r.status === "AVAILABLE") {
    const next = reserveMarkingRecord(markingRecordId, { source, reason: "reserve_before_print" });
    return { releaseOnAbort: next != null };
  }
  return { releaseOnAbort: false };
}

export function abortMarkingPrintSession(
  markingRecordId: string | undefined,
  releaseOnAbort: boolean,
  source: ItemMarkingRecordAuditSource,
): void {
  if (!markingRecordId || !releaseOnAbort) return;
  const r = getMarkingRecordById(markingRecordId);
  if (r?.status === "RESERVED") {
    releaseReservedMarking(markingRecordId, { source, reason: "print_aborted" });
  }
}

export function completeMarkingPrintSuccess(
  markingRecordId: string | undefined,
  printJobId: string | undefined,
  source: ItemMarkingRecordAuditSource,
): void {
  markManyMarkingRecordsPrinted(markingRecordId ? [markingRecordId] : [], { printJobId, source });
}

export function beginBatchMarkingPrintSession(
  markingRecordIds: readonly (string | undefined)[],
  source: ItemMarkingRecordAuditSource,
): Map<string, boolean> {
  const releaseMap = new Map<string, boolean>();
  const seen = new Set<string>();
  for (const raw of markingRecordIds) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const { releaseOnAbort } = beginMarkingPrintSession(id, source);
    releaseMap.set(id, releaseOnAbort);
  }
  return releaseMap;
}

export function abortBatchMarkingPrintSession(releaseMap: Map<string, boolean>, source: ItemMarkingRecordAuditSource): void {
  for (const [id, flag] of releaseMap) {
    abortMarkingPrintSession(id, flag, source);
  }
}

/** Payload for print job audit fields when a marking record was selected. */
export function buildMarkingSnapshotFields(markingRecordId: string | undefined): {
  markingRecordId?: string;
  markingPayloadSnapshot?: string;
  markingKindSnapshot?: ItemMarkingRecordKind;
  markingStatusSnapshot?: ItemMarkingRecordStatus;
} {
  if (!markingRecordId) return {};
  const r = markingRecordRepository.getById(markingRecordId);
  if (!r) return { markingRecordId };
  return {
    markingRecordId: r.id,
    markingPayloadSnapshot: r.payload.slice(0, 4000),
    markingKindSnapshot: r.kind,
    markingStatusSnapshot: r.status,
  };
}
