import type { MarkingAutoSyncScope, MarkingAutoSyncSettings } from "../model/markingAutoSyncSettings";
import { DEFAULT_MARKING_AUTO_SYNC_SETTINGS } from "../model/markingAutoSyncSettings";

const SCOPES: MarkingAutoSyncScope[] = ["problem_only", "printed_and_reserved", "recent_activity", "custom"];

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(x)));
}

function normalizeScope(raw: unknown): MarkingAutoSyncScope {
  const s = typeof raw === "string" ? raw : "";
  return SCOPES.includes(s as MarkingAutoSyncScope) ? (s as MarkingAutoSyncScope) : DEFAULT_MARKING_AUTO_SYNC_SETTINGS.scope;
}

export function normalizeMarkingAutoSyncSettings(
  partial: Partial<MarkingAutoSyncSettings> | null | undefined,
): MarkingAutoSyncSettings {
  const base = { ...DEFAULT_MARKING_AUTO_SYNC_SETTINGS, ...partial };
  const intervalMinutes = clampInt(base.intervalMinutes, DEFAULT_MARKING_AUTO_SYNC_SETTINGS.intervalMinutes, 1, 24 * 60);
  const maxRecordsPerRun = clampInt(base.maxRecordsPerRun, DEFAULT_MARKING_AUTO_SYNC_SETTINGS.maxRecordsPerRun, 1, 10_000);
  return {
    isEnabled: Boolean(base.isEnabled),
    intervalMinutes,
    scope: normalizeScope(base.scope),
    maxRecordsPerRun,
    runOnAppStart: Boolean(base.runOnAppStart),
    runOnlyWhenProviderEnabled: Boolean(base.runOnlyWhenProviderEnabled),
    runOnlyInRealMode: Boolean(base.runOnlyInRealMode),
    updatedAt: typeof base.updatedAt === "string" && base.updatedAt.trim() ? base.updatedAt : new Date().toISOString(),
  };
}
