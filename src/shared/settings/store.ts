import { DEFAULT_APP_SETTINGS } from "./defaults";
import {
  defaultSettingsClone,
  mergeAppSettingsPatch,
  type DeepPartialAppSettings,
} from "./mergeNormalize";
import { persistAppSettings } from "./persistence";
import type { SettingsPersistenceState } from "./persistenceState";
import type { AppSettings, SettingsSectionId } from "./types";

export type { DeepPartialAppSettings } from "./mergeNormalize";

let snapshot: AppSettings = defaultSettingsClone();

const listeners = new Set<() => void>();

let persistenceState: SettingsPersistenceState = "defaults_only";
const persistenceListeners = new Set<() => void>();

export function getSettingsPersistenceState(): SettingsPersistenceState {
  return persistenceState;
}

export function setSettingsPersistenceState(next: SettingsPersistenceState): void {
  if (persistenceState === next) return;
  persistenceState = next;
  for (const l of persistenceListeners) l();
}

export function subscribePersistenceState(listener: () => void): () => void {
  persistenceListeners.add(listener);
  return () => persistenceListeners.delete(listener);
}

/** Synchronous read for services and money helpers (updated on load and every patch). */
export function getAppSettings(): AppSettings {
  return snapshot;
}

export function subscribeAppSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

/**
 * Replace in-memory settings (e.g. after async load). Does not persist.
 */
export function hydrateAppSettings(next: AppSettings): void {
  snapshot = mergeAppSettingsPatch(DEFAULT_APP_SETTINGS, {
    general: next.general,
    documents: next.documents,
    inventory: next.inventory,
    commercial: next.commercial,
    dataAudit: next.dataAudit,
  });
  notify();
}

/**
 * Apply a partial patch, update snapshot, notify, and persist.
 */
export function patchAppSettings(patch: DeepPartialAppSettings): void {
  snapshot = mergeAppSettingsPatch(snapshot, patch);
  notify();
  void persistAppSettings(snapshot).then((state) => {
    setSettingsPersistenceState(state);
  });
}

export function resetSettingsSection(section: SettingsSectionId): void {
  const d = DEFAULT_APP_SETTINGS;
  const patch: DeepPartialAppSettings =
    section === "general"
      ? { general: d.general }
      : section === "documents"
        ? { documents: d.documents }
        : section === "inventory"
          ? { inventory: d.inventory }
          : section === "commercial"
            ? { commercial: d.commercial }
            : { dataAudit: d.dataAudit };
  patchAppSettings(patch);
}
