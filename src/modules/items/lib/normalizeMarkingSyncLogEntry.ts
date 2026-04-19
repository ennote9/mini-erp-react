import type { MarkingSyncLogEntry, MarkingSyncLogAction, MarkingSyncLogStatus } from "../model/markingExternalSync";

const ACTIONS = new Set<MarkingSyncLogAction>([
  "FETCH_STATUS",
  "CONFIRM_USED",
  "VOID_EXTERNAL",
  "BATCH_BY_REF",
  "BATCH_BY_JOB",
]);
const STATUSES = new Set<MarkingSyncLogStatus>(["SUCCESS", "PARTIAL", "FAILED"]);

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeMarkingSyncLogEntry(raw: unknown): MarkingSyncLogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const provider = typeof o.provider === "string" ? o.provider : null;
  const action = o.action;
  const status = o.status;
  const startedAt = typeof o.startedAt === "string" ? o.startedAt : null;
  const finishedAt = typeof o.finishedAt === "string" ? o.finishedAt : null;
  const recordIdsRaw = o.recordIds;
  if (!id || !provider || !startedAt || !finishedAt) return null;
  if (typeof action !== "string" || !ACTIONS.has(action as MarkingSyncLogAction)) return null;
  if (typeof status !== "string" || !STATUSES.has(status as MarkingSyncLogStatus)) return null;
  if (!Array.isArray(recordIdsRaw) || !recordIdsRaw.every((x) => typeof x === "string")) return null;

  return {
    id,
    provider,
    recordIds: recordIdsRaw as string[],
    action: action as MarkingSyncLogAction,
    status: status as MarkingSyncLogStatus,
    startedAt,
    finishedAt,
    message: optStr(o.message),
    details: optStr(o.details),
    externalReference: optStr(o.externalReference),
  };
}
