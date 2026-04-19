import type { MarkingProviderSettings } from "./model/markingProviderSettings";
import { getActiveMarkingExternalAdapter, invalidateMarkingExternalAdapterCache } from "./integration/markingExternalAdapterRegistry";
import { markingProviderSettingsRepository } from "./markingProviderSettingsRepository";

export function getMarkingProviderSettings(): MarkingProviderSettings {
  return markingProviderSettingsRepository.get();
}

export function saveMarkingProviderSettings(patch: Partial<Omit<MarkingProviderSettings, "updatedAt">>): MarkingProviderSettings {
  return markingProviderSettingsRepository.update(patch);
}

export function resetMarkingProviderSettings(): MarkingProviderSettings {
  return markingProviderSettingsRepository.resetToDefaults();
}

/**
 * Runs healthcheck on the adapter that matches current saved settings (cache cleared first).
 */
export async function testMarkingProviderConnection(): Promise<{ ok: boolean; message?: string }> {
  invalidateMarkingExternalAdapterCache();
  const a = getActiveMarkingExternalAdapter();
  return a.healthcheck();
}
