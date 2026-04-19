/**
 * External marking integration: sync log and provider-agnostic action labels.
 * Kept separate from lifecycle audit (print / reserve / reconciliation).
 */

export type MarkingExternalProviderId = "mock" | string;

export type MarkingSyncLogAction = "FETCH_STATUS" | "CONFIRM_USED" | "VOID_EXTERNAL" | "BATCH_BY_REF" | "BATCH_BY_JOB";

export type MarkingSyncLogStatus = "SUCCESS" | "PARTIAL" | "FAILED";

/** One persisted run (batch of records, single provider call surface). */
export interface MarkingSyncLogEntry {
  id: string;
  provider: string;
  recordIds: string[];
  action: MarkingSyncLogAction;
  status: MarkingSyncLogStatus;
  startedAt: string;
  finishedAt: string;
  message?: string;
  /** JSON string for compact UI / debugging (per-record ok flags, etc.). */
  details?: string;
  externalReference?: string;
}

/** Optional HTTP hint for real provider runs (no secrets). */
export type MarkingSyncHttpCallHint = {
  method: string;
  path: string;
  httpStatus?: number;
  errorCode?: string;
};

export type MarkingSyncPerRecordResult = {
  recordId: string;
  ok: boolean;
  message?: string;
  http?: MarkingSyncHttpCallHint;
};
