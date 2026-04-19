import type { ItemMarkingRecordStatus } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditEntry, ItemMarkingRecordAuditSource } from "../model/itemMarkingRecordAudit";

const SOURCES = new Set<ItemMarkingRecordAuditSource>([
  "manual",
  "print_workspace",
  "print_station",
  "print_batch",
  "import",
  "void",
  "mark_used",
  "release",
  "reconciliation",
  "system",
]);

const STATUSES = new Set<ItemMarkingRecordStatus>(["AVAILABLE", "RESERVED", "PRINTED", "USED", "VOID"]);

function isStatus(s: unknown): s is ItemMarkingRecordStatus {
  return typeof s === "string" && STATUSES.has(s as ItemMarkingRecordStatus);
}

export function normalizeItemMarkingRecordAudit(raw: unknown): ItemMarkingRecordAuditEntry | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const markingRecordId = o.markingRecordId;
  const itemId = o.itemId;
  const toStatus = o.toStatus;
  const reason = o.reason;
  const source = o.source;
  const createdAt = o.createdAt;
  if (typeof id !== "string" || !id) return null;
  if (typeof markingRecordId !== "string" || !markingRecordId) return null;
  if (typeof itemId !== "string" || !itemId) return null;
  if (!isStatus(toStatus)) return null;
  if (typeof reason !== "string") return null;
  if (typeof source !== "string" || !SOURCES.has(source as ItemMarkingRecordAuditSource)) return null;
  if (typeof createdAt !== "string" || !createdAt) return null;

  const fromRaw = o.fromStatus;
  const fromStatus: ItemMarkingRecordStatus | null =
    fromRaw === null || fromRaw === undefined ? null : isStatus(fromRaw) ? fromRaw : null;
  if (fromRaw !== null && fromRaw !== undefined && fromStatus === null) return null;

  const printJobId = o.printJobId;
  const note = o.note;
  return {
    id,
    markingRecordId,
    itemId,
    fromStatus,
    toStatus,
    reason,
    source: source as ItemMarkingRecordAuditSource,
    printJobId: typeof printJobId === "string" && printJobId ? printJobId : undefined,
    note: typeof note === "string" && note ? note : undefined,
    createdAt,
  };
}
