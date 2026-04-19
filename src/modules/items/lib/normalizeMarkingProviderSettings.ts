import type { MarkingProviderMode, MarkingProviderSettings } from "../model/markingProviderSettings";
import { DEFAULT_MARKING_PROVIDER_SETTINGS } from "../model/markingProviderSettings";

const MODES = new Set<MarkingProviderMode>(["mock", "real", "disabled"]);

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeMarkingProviderSettings(raw: unknown): MarkingProviderSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MARKING_PROVIDER_SETTINGS, updatedAt: new Date().toISOString() };
  const o = raw as Record<string, unknown>;
  const modeRaw = o.mode;
  const mode: MarkingProviderMode =
    typeof modeRaw === "string" && MODES.has(modeRaw as MarkingProviderMode) ? (modeRaw as MarkingProviderMode) : "mock";
  const providerId = typeof o.providerId === "string" && o.providerId.trim() ? o.providerId.trim() : DEFAULT_MARKING_PROVIDER_SETTINGS.providerId;
  const isEnabled = typeof o.isEnabled === "boolean" ? o.isEnabled : true;
  const timeoutMs =
    typeof o.timeoutMs === "number" && Number.isFinite(o.timeoutMs) && o.timeoutMs > 0 ? Math.floor(o.timeoutMs) : DEFAULT_MARKING_PROVIDER_SETTINGS.timeoutMs;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();

  return {
    providerId,
    mode,
    isEnabled,
    baseUrl: optStr(o.baseUrl),
    apiKey: optStr(o.apiKey),
    timeoutMs,
    updatedAt,
  };
}
