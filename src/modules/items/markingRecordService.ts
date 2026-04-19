import type { ItemMarkingRecord, ItemMarkingRecordKind, ItemMarkingRecordStatus } from "./model/itemMarkingRecord";
import { markingRecordRepository, type CreateItemMarkingRecordInput } from "./markingRecordRepository";

export function listMarkingRecordsByItem(itemId: string): ItemMarkingRecord[] {
  return markingRecordRepository.listByItemId(itemId);
}

/** Codes that can be selected for printing / preview (excludes void and consumed). */
export function listSelectableMarkingRecordsForItem(itemId: string): ItemMarkingRecord[] {
  return listMarkingRecordsByItem(itemId).filter((r) =>
    ["AVAILABLE", "RESERVED", "PRINTED"].includes(r.status),
  );
}

export function getMarkingRecordById(id: string): ItemMarkingRecord | undefined {
  return markingRecordRepository.getById(id);
}

export function createMarkingRecord(input: CreateItemMarkingRecordInput): ItemMarkingRecord {
  return markingRecordRepository.create(input);
}

export function updateMarkingRecordStatus(id: string, status: ItemMarkingRecordStatus): ItemMarkingRecord | undefined {
  return markingRecordRepository.update(id, { status });
}

export function voidMarkingRecord(id: string): ItemMarkingRecord | undefined {
  return markingRecordRepository.update(id, { status: "VOID" });
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

/**
 * Reserve the first matching AVAILABLE record (by kind), or undefined if none.
 */
export function reserveNextAvailableMarking(itemId: string, kind: ItemMarkingRecordKind): ItemMarkingRecord | undefined {
  const candidates = markingRecordRepository
    .listByItemId(itemId)
    .filter((r) => r.kind === kind && r.status === "AVAILABLE")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pick = candidates[0];
  if (!pick) return undefined;
  return markingRecordRepository.update(pick.id, { status: "RESERVED" });
}

export function releaseReservedMarking(id: string): ItemMarkingRecord | undefined {
  const r = markingRecordRepository.getById(id);
  if (!r || r.status !== "RESERVED") return undefined;
  return markingRecordRepository.update(id, { status: "AVAILABLE" });
}

export function markMarkingRecordPrinted(id: string): ItemMarkingRecord | undefined {
  const r = markingRecordRepository.getById(id);
  if (!r) return undefined;
  if (r.status === "VOID" || r.status === "USED") return undefined;
  return markingRecordRepository.update(id, { status: "PRINTED" });
}

export function markManyMarkingRecordsPrinted(ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    markMarkingRecordPrinted(id);
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
