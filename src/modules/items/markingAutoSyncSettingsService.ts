import type { MarkingAutoSyncSettings } from "./model/markingAutoSyncSettings";
import { markingAutoSyncSettingsRepository } from "./markingAutoSyncSettingsRepository";

export function getMarkingAutoSyncSettings(): MarkingAutoSyncSettings {
  return markingAutoSyncSettingsRepository.get();
}

export function saveMarkingAutoSyncSettings(patch: Partial<Omit<MarkingAutoSyncSettings, "updatedAt">>): MarkingAutoSyncSettings {
  return markingAutoSyncSettingsRepository.update(patch);
}

export function resetMarkingAutoSyncSettings(): MarkingAutoSyncSettings {
  return markingAutoSyncSettingsRepository.resetToDefaults();
}
