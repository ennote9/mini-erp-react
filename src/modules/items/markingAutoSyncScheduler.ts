import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import { markingAutoSyncSettingsRepository } from "./markingAutoSyncSettingsRepository";
import { markingProviderSettingsRepository } from "./markingProviderSettingsRepository";
import { markingRecordRepository } from "./markingRecordRepository";
import { collectAutoSyncRecordIds } from "./lib/markingAutoSyncSelection";
import { getActiveMarkingFetchSyncTrigger, syncMarkingRecords } from "./markingExternalSyncService";
import type { MarkingExternalSyncRunResult } from "./markingExternalSyncService";
import { getActiveMarkingExternalAdapter } from "./integration/markingExternalAdapterRegistry";

export type MarkingAutoSyncSchedulerLastStatus = "idle" | "success" | "partial" | "failed" | "skipped" | "blocked";

export type MarkingAutoSyncSchedulerState = {
  /** Interval timer is armed (auto-sync enabled and app scheduler active). */
  isRunning: boolean;
  /** Saved auto-sync master toggle. */
  isEnabled: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastStatus: MarkingAutoSyncSchedulerLastStatus;
  lastMessage: string | null;
  lastProcessedCount: number | null;
  lastLogId: string | null;
  nextPlannedRunAt: string | null;
  /** A sync fetch (manual or auto) is currently executing. */
  inFlight: boolean;
  skippedTicksCount: number;
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let timerArmed = false;
let skippedTicksCount = 0;

let lastStartedAt: string | null = null;
let lastFinishedAt: string | null = null;
let lastStatus: MarkingAutoSyncSchedulerLastStatus = "idle";
let lastMessage: string | null = null;
let lastProcessedCount: number | null = null;
let lastLogId: string | null = null;
let nextPlannedRunAt: string | null = null;

let appStartHandled = false;

function bump(): void {
  bumpAppReadModelRevision();
}

function clearTimer(): void {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  timerArmed = false;
}

function scheduleNextBoundary(): void {
  const s = markingAutoSyncSettingsRepository.get();
  const ms = Math.max(1, s.intervalMinutes) * 60_000;
  nextPlannedRunAt = new Date(Date.now() + ms).toISOString();
}

/**
 * Full scheduler state for settings / sync console.
 */
export function getMarkingAutoSyncSchedulerState(): MarkingAutoSyncSchedulerState {
  const settings = markingAutoSyncSettingsRepository.get();
  return {
    isRunning: timerArmed,
    isEnabled: settings.isEnabled,
    lastStartedAt,
    lastFinishedAt,
    lastStatus,
    lastMessage,
    lastProcessedCount,
    lastLogId,
    nextPlannedRunAt,
    inFlight: getActiveMarkingFetchSyncTrigger() !== null,
    skippedTicksCount,
  };
}

function mapRunResultToStatus(r: MarkingExternalSyncRunResult): MarkingAutoSyncSchedulerLastStatus {
  if (r.message === "skipped_in_flight") return "skipped";
  if (r.status === "SUCCESS") return "success";
  if (r.status === "PARTIAL") return "partial";
  return "failed";
}

export type MarkingAutoSyncManualRunResult = MarkingExternalSyncRunResult | { blocked: true; message: string };

/**
 * Executes one automatic sync pass (policy, selection, then shared sync pipeline).
 */
export async function runMarkingAutoSyncNow(): Promise<MarkingAutoSyncManualRunResult> {
  const settings = markingAutoSyncSettingsRepository.get();
  const provider = markingProviderSettingsRepository.get();

  lastStartedAt = new Date().toISOString();
  lastStatus = "idle";
  lastMessage = null;
  bump();

  if (!settings.isEnabled) {
    const msg = "auto_sync_disabled";
    lastFinishedAt = new Date().toISOString();
    lastStatus = "blocked";
    lastMessage = msg;
    lastProcessedCount = null;
    lastLogId = null;
    bump();
    return { blocked: true, message: msg };
  }

  if (settings.runOnlyWhenProviderEnabled && !provider.isEnabled) {
    const msg = "provider_not_enabled";
    lastFinishedAt = new Date().toISOString();
    lastStatus = "blocked";
    lastMessage = msg;
    lastProcessedCount = null;
    lastLogId = null;
    bump();
    return { blocked: true, message: msg };
  }

  if (!provider.isEnabled || provider.mode === "disabled") {
    const msg = "provider_disabled";
    lastFinishedAt = new Date().toISOString();
    lastStatus = "blocked";
    lastMessage = msg;
    lastProcessedCount = null;
    lastLogId = null;
    bump();
    return { blocked: true, message: msg };
  }

  if (settings.runOnlyInRealMode && provider.mode !== "real") {
    const msg = "auto_sync_real_mode_only";
    lastFinishedAt = new Date().toISOString();
    lastStatus = "blocked";
    lastMessage = msg;
    lastProcessedCount = null;
    lastLogId = null;
    bump();
    return { blocked: true, message: msg };
  }

  const ids = collectAutoSyncRecordIds(settings.scope, settings.maxRecordsPerRun, markingRecordRepository.list());

  if (ids.length === 0) {
    lastFinishedAt = new Date().toISOString();
    lastStatus = "skipped";
    lastMessage = "no_records_selected";
    lastProcessedCount = 0;
    lastLogId = null;
    bump();
    return { blocked: true, message: "no_records_selected" };
  }

  try {
    const result = await syncMarkingRecords(ids, "FETCH_STATUS", {}, { trigger: "auto", autoScope: settings.scope });
    lastFinishedAt = new Date().toISOString();
    lastProcessedCount = result.perRecord.length;
    lastLogId = result.logId || null;
    lastStatus = mapRunResultToStatus(result);
    lastMessage = result.message ?? null;
    if (result.message === "skipped_in_flight") {
      skippedTicksCount += 1;
    }
    bump();
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const adapter = getActiveMarkingExternalAdapter();
    lastFinishedAt = new Date().toISOString();
    lastStatus = "failed";
    lastMessage = msg;
    lastProcessedCount = null;
    lastLogId = null;
    bump();
    return {
      logId: "",
      status: "FAILED",
      action: "FETCH_STATUS",
      provider: adapter.id,
      isMock: adapter.isMock,
      perRecord: [],
      message: msg,
    };
  }
}

async function onIntervalTick(): Promise<void> {
  const settings = markingAutoSyncSettingsRepository.get();
  if (!settings.isEnabled) {
    restartMarkingAutoSyncScheduler();
    return;
  }
  scheduleNextBoundary();
  bump();
  await runMarkingAutoSyncNow();
}

/**
 * Rebuilds the interval from current settings (also called after provider / auto-sync changes).
 */
export function restartMarkingAutoSyncScheduler(): void {
  clearTimer();
  nextPlannedRunAt = null;

  const settings = markingAutoSyncSettingsRepository.get();
  if (!settings.isEnabled) {
    bump();
    return;
  }

  timerArmed = true;
  scheduleNextBoundary();

  const ms = Math.max(1, settings.intervalMinutes) * 60_000;
  intervalId = setInterval(() => {
    void onIntervalTick();
  }, ms);
  bump();
}

function maybeRunOnAppStart(): void {
  if (appStartHandled) return;
  appStartHandled = true;
  const settings = markingAutoSyncSettingsRepository.get();
  if (!settings.isEnabled || !settings.runOnAppStart) return;
  void runMarkingAutoSyncNow();
}

/**
 * Starts the foreground scheduler. Safe to call once from the app shell.
 */
export function startMarkingAutoSyncScheduler(): () => void {
  restartMarkingAutoSyncScheduler();
  queueMicrotask(() => {
    maybeRunOnAppStart();
  });
  return () => {
    clearTimer();
    nextPlannedRunAt = null;
    bump();
  };
}
