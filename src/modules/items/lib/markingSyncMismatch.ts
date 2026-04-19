import type { ItemMarkingRecord, ItemMarkingRecordStatus } from "../model/itemMarkingRecord";

export type MarkingSyncProblemKind = "never_synced" | "sync_failed" | "mismatch";

/** Map external free-form string to closest internal lifecycle bucket for comparison. */
export function inferSemanticFromExternalStatus(external?: string): ItemMarkingRecordStatus | "UNKNOWN" {
  if (external == null || external.trim() === "") return "UNKNOWN";
  const u = external.toUpperCase();
  if (u.includes("VOID") || u.includes("WITHDRAWN") || u.includes("REVOKED")) return "VOID";
  if (u.includes("APPLIED") || u.includes("CONSUMED") || u.includes("USED") || u.endsWith("_USED")) return "USED";
  if (u.includes("PRINTED") || u.includes("EMITTED")) return "PRINTED";
  if (u.includes("RESERVED") || u.includes("LOCKED")) return "RESERVED";
  if (u.includes("ACTIVE") || u.includes("AVAILABLE") || u.includes("REGISTERED")) return "AVAILABLE";
  return "UNKNOWN";
}

export function isNeverSynced(record: ItemMarkingRecord): boolean {
  return !record.lastSyncAt;
}

export function isLastSyncFailed(record: ItemMarkingRecord): boolean {
  return record.lastSyncStatus === "FAILED";
}

/**
 * Internal lifecycle vs last known external semantic disagree (both sides known enough to compare).
 */
export function isSyncMismatch(record: ItemMarkingRecord): boolean {
  if (!record.lastSyncAt || record.lastSyncStatus === "FAILED") return false;
  const ext = inferSemanticFromExternalStatus(record.externalStatus);
  if (ext === "UNKNOWN") return false;
  return ext !== record.status;
}

export function getSyncProblemKind(record: ItemMarkingRecord): MarkingSyncProblemKind | null {
  if (isNeverSynced(record)) return "never_synced";
  if (isLastSyncFailed(record)) return "sync_failed";
  if (isSyncMismatch(record)) return "mismatch";
  return null;
}
