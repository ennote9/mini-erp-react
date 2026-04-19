import type { MarkingProviderSettings } from "./model/markingProviderSettings";
import { DEFAULT_MARKING_PROVIDER_SETTINGS } from "./model/markingProviderSettings";
import { writeMarkingProviderSettingsPayload, loadMarkingProviderSettingsPersisted } from "./lib/markingProviderSettingsPersistence";
import { normalizeMarkingProviderSettings } from "./lib/normalizeMarkingProviderSettings";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import { invalidateMarkingExternalAdapterCache } from "./integration/markingAdapterCache";

let store: MarkingProviderSettings = { ...DEFAULT_MARKING_PROVIDER_SETTINGS, updatedAt: new Date().toISOString() };
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMarkingProviderSettingsPayload(store);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[markingProviderSettingsRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getMarkingProviderSettingsPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingMarkingProviderSettingsPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMarkingProviderSettingsPersisted();
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store = loaded.settings;
}

export const markingProviderSettingsRepository = {
  get(): MarkingProviderSettings {
    return { ...store };
  },

  update(patch: Partial<Omit<MarkingProviderSettings, "updatedAt">>): MarkingProviderSettings {
    store = normalizeMarkingProviderSettings({
      ...store,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    invalidateMarkingExternalAdapterCache();
    schedulePersist();
    return { ...store };
  },

  resetToDefaults(): MarkingProviderSettings {
    store = normalizeMarkingProviderSettings({
      ...DEFAULT_MARKING_PROVIDER_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    invalidateMarkingExternalAdapterCache();
    schedulePersist();
    return { ...store };
  },
};

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "marking-provider-settings",
  flush: flushPendingMarkingProviderSettingsPersist,
  isBusy: getMarkingProviderSettingsPersistBusy,
});
