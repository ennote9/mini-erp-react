import type { MarkingSyncHttpCallHint, MarkingSyncPerRecordResult } from "../model/markingExternalSync";

export type MarkingSyncLogDetailsPayload = {
  perRecord: MarkingSyncPerRecordResult[];
  isMock: boolean;
  input?: {
    recordIds?: string[];
    batchRef?: string;
    printJobId?: string;
  };
  /** Single HTTP round-trip for batch confirm/void when useful. */
  batchCall?: MarkingSyncHttpCallHint;
};

export function stringifySyncLogDetails(payload: MarkingSyncLogDetailsPayload): string {
  return JSON.stringify(payload);
}

export function parseSyncLogDetails(raw: string | undefined): MarkingSyncLogDetailsPayload | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as MarkingSyncLogDetailsPayload;
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}
