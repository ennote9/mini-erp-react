import type { MarkingExternalBatchAckResult, MarkingExternalRecordRef, MarkingExternalSyncCallMeta } from "./integration/markingExternalAdapterTypes";
import type { MarkingProviderMode } from "./model/markingProviderSettings";
import type { MarkingAutoSyncScope } from "./model/markingAutoSyncSettings";
import type { MarkingSyncHttpCallHint, MarkingSyncLogAction, MarkingSyncLogStatus, MarkingSyncPerRecordResult } from "./model/markingExternalSync";
import { getActiveMarkingExternalAdapter, invalidateMarkingExternalAdapterCache } from "./integration/markingExternalAdapterRegistry";
import { stringifySyncLogDetails, parseSyncLogDetails } from "./lib/markingSyncLogPayload";
import {
  tryMarkingFetchSyncAuto,
  endMarkingFetchSyncAuto,
  enterMarkingFetchSyncManual,
  endMarkingFetchSyncManual,
  setActiveMarkingFetchSyncTrigger,
} from "./lib/markingSyncFetchGate";
import { markingProviderSettingsRepository } from "./markingProviderSettingsRepository";
import { markingRecordRepository } from "./markingRecordRepository";
import { markingSyncLogRepository } from "./markingSyncLogRepository";
import { getMarkingRecordById, listMarkingRecordIdsByPrintJobId } from "./markingRecordService";

export type MarkingExternalSyncRunResult = {
  logId: string;
  status: MarkingSyncLogStatus;
  action: MarkingSyncLogAction;
  provider: string;
  isMock: boolean;
  perRecord: MarkingSyncPerRecordResult[];
  message?: string;
  /** Present for {@link syncMarkingRecords} runs. */
  syncTrigger?: "manual" | "auto";
};

export type MarkingExternalIntegrationInfo = {
  adapterId: string;
  displayName: string;
  isMock: boolean;
  mode: MarkingProviderMode;
  isEnabled: boolean;
  /** What the UI should show: mock / real HTTP provider / off. */
  effectiveLabel: "mock" | "real" | "disabled";
};

function isSyncBlockedBySettings(): boolean {
  const s = markingProviderSettingsRepository.get();
  return !s.isEnabled || s.mode === "disabled";
}

function metaToLog(m?: MarkingExternalSyncCallMeta): MarkingSyncHttpCallHint | undefined {
  if (!m) return undefined;
  return {
    method: m.method,
    path: m.path,
    httpStatus: m.httpStatus,
    errorCode: m.errorCode,
  };
}

function finalizeStatus(perRecord: MarkingSyncPerRecordResult[]): MarkingSyncLogStatus {
  if (perRecord.length === 0) return "FAILED";
  const okN = perRecord.filter((p) => p.ok).length;
  if (okN === perRecord.length) return "SUCCESS";
  if (okN === 0) return "FAILED";
  return "PARTIAL";
}

/**
 * Extended info for banners (mock vs real vs disabled).
 */
export function getMarkingExternalIntegrationInfo(): MarkingExternalIntegrationInfo {
  const s = markingProviderSettingsRepository.get();
  const a = getActiveMarkingExternalAdapter();
  const effectiveLabel: MarkingExternalIntegrationInfo["effectiveLabel"] =
    !s.isEnabled || s.mode === "disabled" ? "disabled" : s.mode === "mock" ? "mock" : "real";
  return {
    adapterId: a.id,
    displayName: a.displayName,
    isMock: a.isMock,
    mode: s.mode,
    isEnabled: s.isEnabled,
    effectiveLabel,
  };
}

/** @deprecated Prefer {@link getMarkingExternalIntegrationInfo} for mode-aware UI. */
export function getMarkingExternalAdapterInfo(): { id: string; displayName: string; isMock: boolean } {
  const x = getMarkingExternalIntegrationInfo();
  return { id: x.adapterId, displayName: x.displayName, isMock: x.isMock };
}

export type SyncLogInputMeta = {
  recordIds?: string[];
  batchRef?: string;
  printJobId?: string;
};

export type SyncMarkingRecordsOptions = {
  trigger?: "manual" | "auto";
  autoScope?: MarkingAutoSyncScope;
};

function formatFetchSyncMessage(adapter: { isMock: boolean }, body: string, opts?: SyncMarkingRecordsOptions): string {
  const mock = adapter.isMock ? "[mock] " : "";
  const trigger = opts?.trigger ?? "manual";
  const auto = trigger === "auto" ? `[auto${opts?.autoScope ? `·${opts.autoScope}` : ""}] ` : "";
  return `${mock}${auto}${body}`;
}

function fetchLogDetails(
  base: { perRecord: MarkingSyncPerRecordResult[]; isMock: boolean; input?: SyncLogInputMeta },
  opts?: SyncMarkingRecordsOptions,
): string {
  const trigger = opts?.trigger ?? "manual";
  return stringifySyncLogDetails({
    ...base,
    trigger,
    ...(trigger === "auto" && opts?.autoScope ? { autoScope: opts.autoScope } : {}),
  });
}

/**
 * Poll external registry and update optional snapshot fields on records. Does not change internal lifecycle status.
 */
export async function syncMarkingRecords(
  recordIds: readonly string[],
  action: MarkingSyncLogAction = "FETCH_STATUS",
  logInput?: SyncLogInputMeta,
  options?: SyncMarkingRecordsOptions,
): Promise<MarkingExternalSyncRunResult> {
  const adapter = getActiveMarkingExternalAdapter();
  const trigger = options?.trigger ?? "manual";

    if (trigger === "auto") {
    if (!tryMarkingFetchSyncAuto()) {
      return {
        logId: "",
        status: "FAILED",
        action,
        provider: adapter.id,
        isMock: adapter.isMock,
        perRecord: [],
        message: "skipped_in_flight",
        syncTrigger: "auto",
      };
    }
  } else {
    await enterMarkingFetchSyncManual();
  }

  setActiveMarkingFetchSyncTrigger(trigger);
  try {
    const startedAt = new Date().toISOString();
    const uniq = [...new Set(recordIds.map((x) => x?.trim()).filter(Boolean))] as string[];

    const inputForLog: SyncLogInputMeta = {
      recordIds: uniq,
      ...(logInput?.batchRef != null ? { batchRef: logInput.batchRef } : {}),
      ...(logInput?.printJobId != null ? { printJobId: logInput.printJobId } : {}),
    };

    if (uniq.length === 0) {
      const finishedAt = new Date().toISOString();
      const msg = isSyncBlockedBySettings() ? "provider_disabled" : "no_records";
      const log = markingSyncLogRepository.append({
        provider: adapter.id,
        recordIds: [],
        action,
        status: "FAILED",
        startedAt,
        finishedAt,
        message: formatFetchSyncMessage(adapter, msg, options),
        details: fetchLogDetails({ perRecord: [], isMock: adapter.isMock, input: inputForLog }, options),
        externalReference: undefined,
      });
      return {
        logId: log.id,
        status: "FAILED",
        action,
        provider: adapter.id,
        isMock: adapter.isMock,
        perRecord: [],
        message: log.message,
        syncTrigger: trigger,
      };
    }

    if (isSyncBlockedBySettings()) {
      const finishedAt = new Date().toISOString();
      const perRecord: MarkingSyncPerRecordResult[] = uniq.map((id) => ({
        recordId: id,
        ok: false,
        message: "provider_disabled",
      }));
      const log = markingSyncLogRepository.append({
        provider: adapter.id,
        recordIds: uniq,
        action,
        status: "FAILED",
        startedAt,
        finishedAt,
        message: formatFetchSyncMessage(adapter, "provider_disabled", options),
        details: fetchLogDetails({ perRecord, isMock: adapter.isMock, input: inputForLog }, options),
        externalReference: undefined,
      });
      return {
        logId: log.id,
        status: "FAILED",
        action,
        provider: adapter.id,
        isMock: adapter.isMock,
        perRecord,
        message: log.message,
        syncTrigger: trigger,
      };
    }

    const perRecord: MarkingSyncPerRecordResult[] = [];

    for (const id of uniq) {
      const record = getMarkingRecordById(id);
      if (!record) {
        perRecord.push({ recordId: id, ok: false, message: "record_not_found" });
        continue;
      }

      const res = await adapter.fetchCodeStatus({
        recordId: id,
        itemId: record.itemId,
        payload: record.payload,
        kind: record.kind,
        externalCodeRef: record.externalCodeRef,
      });

      const finishedOne = new Date().toISOString();

      if (res.ok && res.externalStatus != null) {
        markingRecordRepository.update(id, {
          externalStatus: res.externalStatus,
          externalCodeRef: res.externalCodeRef,
          externalProvider: adapter.id,
          lastSyncAt: finishedOne,
          lastSyncStatus: "SUCCESS",
          lastSyncMessage: res.message ?? "sync_ok",
        });
        perRecord.push({ recordId: id, ok: true, message: res.message, http: metaToLog(res.syncMeta) });
      } else {
        markingRecordRepository.update(id, {
          lastSyncAt: finishedOne,
          lastSyncStatus: "FAILED",
          lastSyncMessage: res.message ?? "sync_fetch_failed",
        });
        perRecord.push({
          recordId: id,
          ok: false,
          message: res.message ?? "sync_fetch_failed",
          http: metaToLog(res.syncMeta),
        });
      }
    }

    const finishedAt = new Date().toISOString();
    const status = finalizeStatus(perRecord);

    const log = markingSyncLogRepository.append({
      provider: adapter.id,
      recordIds: uniq,
      action,
      status,
      startedAt,
      finishedAt,
      message: formatFetchSyncMessage(
        adapter,
        `${status} · ${perRecord.filter((p) => p.ok).length}/${perRecord.length}`,
        options,
      ),
      details: fetchLogDetails({ perRecord, isMock: adapter.isMock, input: inputForLog }, options),
      externalReference: undefined,
    });

    return {
      logId: log.id,
      status,
      action,
      provider: adapter.id,
      isMock: adapter.isMock,
      perRecord,
      message: log.message,
      syncTrigger: trigger,
    };
  } finally {
    setActiveMarkingFetchSyncTrigger(null);
    if (trigger === "auto") {
      endMarkingFetchSyncAuto();
    } else {
      endMarkingFetchSyncManual();
    }
  }
}

export async function syncByBatchRef(batchRef: string): Promise<MarkingExternalSyncRunResult> {
  const q = batchRef.trim();
  const adapter = getActiveMarkingExternalAdapter();
  if (!q) {
    const startedAt = new Date().toISOString();
    const finishedAt = startedAt;
    const log = markingSyncLogRepository.append({
      provider: adapter.id,
      recordIds: [],
      action: "BATCH_BY_REF",
      status: "FAILED",
      startedAt,
      finishedAt,
      message: "empty_batch_ref",
      details: stringifySyncLogDetails({ perRecord: [], isMock: adapter.isMock, input: { batchRef: "" } }),
    });
    return {
      logId: log.id,
      status: "FAILED",
      action: "BATCH_BY_REF",
      provider: adapter.id,
      isMock: adapter.isMock,
      perRecord: [],
      message: log.message,
    };
  }
  const ids = markingRecordRepository.list().filter((r) => (r.batchRef ?? "").trim() === q).map((r) => r.id);
  return syncMarkingRecords(ids, "BATCH_BY_REF", { batchRef: q });
}

export async function syncByPrintJob(printJobId: string): Promise<MarkingExternalSyncRunResult> {
  const job = printJobId.trim();
  const adapter = getActiveMarkingExternalAdapter();
  if (!job) {
    const startedAt = new Date().toISOString();
    const finishedAt = startedAt;
    const log = markingSyncLogRepository.append({
      provider: adapter.id,
      recordIds: [],
      action: "BATCH_BY_JOB",
      status: "FAILED",
      startedAt,
      finishedAt,
      message: "empty_job",
      details: stringifySyncLogDetails({ perRecord: [], isMock: adapter.isMock, input: { printJobId: "" } }),
    });
    return {
      logId: log.id,
      status: "FAILED",
      action: "BATCH_BY_JOB",
      provider: adapter.id,
      isMock: adapter.isMock,
      perRecord: [],
      message: log.message,
    };
  }
  const ids = listMarkingRecordIdsByPrintJobId(job);
  return syncMarkingRecords(ids, "BATCH_BY_JOB", { printJobId: job });
}

/** Ack-only: notify external system; does not transition internal lifecycle. */
export async function confirmMarkingRecordsUsedExternally(recordIds: readonly string[]): Promise<MarkingExternalSyncRunResult> {
  const adapter = getActiveMarkingExternalAdapter();
  const startedAt = new Date().toISOString();
  const uniq = [...new Set(recordIds.map((x) => x?.trim()).filter(Boolean))] as string[];

  const refs: MarkingExternalRecordRef[] = uniq
    .map((id) => {
      const r = getMarkingRecordById(id);
      if (!r) return null;
      return {
        recordId: id,
        itemId: r.itemId,
        payload: r.payload,
        kind: r.kind,
        externalCodeRef: r.externalCodeRef,
      };
    })
    .filter(Boolean) as MarkingExternalRecordRef[];

  const ack: MarkingExternalBatchAckResult = refs.length ? await adapter.confirmCodesUsed(refs) : { ok: false, message: "no_valid_records" };
  const ackMap = new Map((ack.perRecord ?? []).map((p) => [p.recordId, p] as const));
  const finishedAt = new Date().toISOString();

  const perRecord: MarkingSyncPerRecordResult[] = uniq.map((id) => {
    const rec = getMarkingRecordById(id);
    if (!rec) {
      return { recordId: id, ok: false, message: "record_not_found" };
    }
    const row = ackMap.get(id);
    if (row) {
      return {
        recordId: id,
        ok: row.ok,
        message: row.message,
        http: metaToLog(row.syncMeta),
      };
    }
    return {
      recordId: id,
      ok: ack.ok,
      message: ack.message,
      http: metaToLog(ack.syncMeta),
    };
  });

  const status = finalizeStatus(perRecord);

  const log = markingSyncLogRepository.append({
    provider: adapter.id,
    recordIds: uniq,
    action: "CONFIRM_USED",
    status,
    startedAt,
    finishedAt,
    message: `${adapter.isMock ? "[mock] " : ""}${status} · ${perRecord.filter((p) => p.ok).length}/${perRecord.length} · ${ack.message ?? ""}`,
    details: stringifySyncLogDetails({
      perRecord,
      isMock: adapter.isMock,
      input: { recordIds: uniq },
      batchCall: metaToLog(ack.syncMeta),
    }),
    externalReference: ack.externalReference,
  });

  return {
    logId: log.id,
    status: log.status,
    action: "CONFIRM_USED",
    provider: adapter.id,
    isMock: adapter.isMock,
    perRecord,
    message: log.message,
  };
}

export async function voidMarkingRecordsExternally(recordIds: readonly string[]): Promise<MarkingExternalSyncRunResult> {
  const adapter = getActiveMarkingExternalAdapter();
  const startedAt = new Date().toISOString();
  const uniq = [...new Set(recordIds.map((x) => x?.trim()).filter(Boolean))] as string[];

  const refs: MarkingExternalRecordRef[] = uniq
    .map((id) => {
      const r = getMarkingRecordById(id);
      if (!r) return null;
      return {
        recordId: id,
        itemId: r.itemId,
        payload: r.payload,
        kind: r.kind,
        externalCodeRef: r.externalCodeRef,
      };
    })
    .filter(Boolean) as MarkingExternalRecordRef[];

  const ack: MarkingExternalBatchAckResult = refs.length ? await adapter.voidCodes(refs) : { ok: false, message: "no_valid_records" };
  const ackMap = new Map((ack.perRecord ?? []).map((p) => [p.recordId, p] as const));
  const finishedAt = new Date().toISOString();

  const perRecord: MarkingSyncPerRecordResult[] = uniq.map((id) => {
    const rec = getMarkingRecordById(id);
    if (!rec) {
      return { recordId: id, ok: false, message: "record_not_found" };
    }
    const row = ackMap.get(id);
    if (row) {
      return {
        recordId: id,
        ok: row.ok,
        message: row.message,
        http: metaToLog(row.syncMeta),
      };
    }
    return {
      recordId: id,
      ok: ack.ok,
      message: ack.message,
      http: metaToLog(ack.syncMeta),
    };
  });

  const status = finalizeStatus(perRecord);

  const log = markingSyncLogRepository.append({
    provider: adapter.id,
    recordIds: uniq,
    action: "VOID_EXTERNAL",
    status,
    startedAt,
    finishedAt,
    message: `${adapter.isMock ? "[mock] " : ""}${status} · ${perRecord.filter((p) => p.ok).length}/${perRecord.length} · ${ack.message ?? ""}`,
    details: stringifySyncLogDetails({
      perRecord,
      isMock: adapter.isMock,
      input: { recordIds: uniq },
      batchCall: metaToLog(ack.syncMeta),
    }),
    externalReference: ack.externalReference,
  });

  return {
    logId: log.id,
    status: log.status,
    action: "VOID_EXTERNAL",
    provider: adapter.id,
    isMock: adapter.isMock,
    perRecord,
    message: log.message,
  };
}

/**
 * Re-run a previous sync using structured details (best-effort).
 */
export async function rerunMarkingSyncLogEntry(logId: string): Promise<MarkingExternalSyncRunResult | null> {
  const entry = markingSyncLogRepository.getById(logId);
  if (!entry) return null;
  const d = parseSyncLogDetails(entry.details);
  const input = d?.input;

  switch (entry.action) {
    case "BATCH_BY_REF":
      if (input?.batchRef?.trim()) return syncByBatchRef(input.batchRef.trim());
      return null;
    case "BATCH_BY_JOB":
      if (input?.printJobId?.trim()) return syncByPrintJob(input.printJobId.trim());
      return null;
    case "FETCH_STATUS":
    case "CONFIRM_USED":
    case "VOID_EXTERNAL": {
      const ids = input?.recordIds?.length ? input.recordIds : entry.recordIds;
      if (!ids.length) return null;
      if (entry.action === "FETCH_STATUS") {
        const trigger = d?.trigger === "auto" ? "auto" : "manual";
        const autoScope = d?.autoScope;
        return syncMarkingRecords(ids, "FETCH_STATUS", {}, { trigger, autoScope });
      }
      if (entry.action === "CONFIRM_USED") return confirmMarkingRecordsUsedExternally(ids);
      return voidMarkingRecordsExternally(ids);
    }
    default:
      return null;
  }
}

/** For settings screen: force fresh adapter after config edits. */
export function refreshMarkingExternalAdapterCache(): void {
  invalidateMarkingExternalAdapterCache();
}

export { getActiveMarkingFetchSyncTrigger } from "./lib/markingSyncFetchGate";
