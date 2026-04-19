import type {
  ItemMarkingRecord,
  ItemMarkingRecordKind,
  ItemMarkingRecordSource,
  ItemMarkingRecordStatus,
} from "../model/itemMarkingRecord";

const KINDS = new Set<ItemMarkingRecordKind>(["MARKING", "KIZ", "DATAMATRIX", "GS1_DATAMATRIX"]);
const STATUSES = new Set<ItemMarkingRecordStatus>(["AVAILABLE", "RESERVED", "PRINTED", "USED", "VOID"]);
const SOURCES = new Set<ItemMarkingRecordSource>(["MANUAL", "IMPORT", "GENERATED", "OTHER"]);

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeItemMarkingRecord(raw: unknown): ItemMarkingRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const itemId = typeof o.itemId === "string" ? o.itemId : null;
  const kind = o.kind;
  const payload = typeof o.payload === "string" ? o.payload : null;
  const status = o.status;
  if (!id || !itemId || payload === null) return null;
  if (typeof kind !== "string" || !KINDS.has(kind as ItemMarkingRecordKind)) return null;
  if (typeof status !== "string" || !STATUSES.has(status as ItemMarkingRecordStatus)) return null;

  const sourceRaw = o.source;
  const source =
    typeof sourceRaw === "string" && SOURCES.has(sourceRaw as ItemMarkingRecordSource)
      ? (sourceRaw as ItemMarkingRecordSource)
      : undefined;

  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  const lastSyncStatusRaw = o.lastSyncStatus;
  const lastSyncStatus =
    lastSyncStatusRaw === "SUCCESS" || lastSyncStatusRaw === "FAILED" || lastSyncStatusRaw === "PARTIAL"
      ? lastSyncStatusRaw
      : undefined;

  return {
    id,
    itemId,
    kind: kind as ItemMarkingRecordKind,
    payload,
    humanLabel: optStr(o.humanLabel),
    status: status as ItemMarkingRecordStatus,
    source,
    batchRef: optStr(o.batchRef),
    serial: optStr(o.serial),
    note: optStr(o.note),
    externalStatus: optStr(o.externalStatus),
    externalProvider: optStr(o.externalProvider),
    externalCodeRef: optStr(o.externalCodeRef),
    lastSyncAt: typeof o.lastSyncAt === "string" ? o.lastSyncAt : undefined,
    lastSyncStatus,
    lastSyncMessage: optStr(o.lastSyncMessage),
    createdAt,
    updatedAt,
  };
}
