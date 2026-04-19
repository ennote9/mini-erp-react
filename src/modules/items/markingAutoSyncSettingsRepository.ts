import type { MarkingAutoSyncSettings } from "./model/markingAutoSyncSettings";
import { DEFAULT_MARKING_AUTO_SYNC_SETTINGS } from "./model/markingAutoSyncSettings";
import { writeMarkingAutoSyncSettingsPayload, loadMarkingAutoSyncSettingsPersisted } from "./lib/markingAutoSyncSettingsPersistence";
import { normalizeMarkingAutoSyncSettings } from "./lib/normalizeMarkingAutoSyncSettings";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

let store: MarkingAutoSyncSettings = normalizeMarkingAutoSyncSettings({
  ...DEFAULT_MARKING_AUTO_SYNC_SETTINGS,
  updatedAt: new Date().toISOString(),
});
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMarkingAutoSyncSettingsPayload(store);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[markingAutoSyncSettingsRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

function notifySchedulerRestart(): void {
  void import("./markingAutoSyncScheduler").then((m) => m.restartMarkingAutoSyncScheduler());
}

export function getMarkingAutoSyncSettingsPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingMarkingAutoSyncSettingsPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMarkingAutoSyncSettingsPersisted();
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store = loaded.settings;
}

export const markingAutoSyncSettingsRepository = {
  get(): MarkingAutoSyncSettings {
    return { ...store };
  },

  update(patch: Partial<Omit<MarkingAutoSyncSettings, "updatedAt">>): MarkingAutoSyncSettings {
    store = normalizeMarkingAutoSyncSettings({
      ...store,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    schedulePersist();
    notifySchedulerRestart();
    return { ...store };
  },

  resetToDefaults(): MarkingAutoSyncSettings {
    store = normalizeMarkingAutoSyncSettings({
      ...DEFAULT_MARKING_AUTO_SYNC_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    schedulePersist();
    notifySchedulerRestart();
    return { ...store };
  },
};

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "marking-auto-sync-settings",
  flush: flushPendingMarkingAutoSyncSettingsPersist,
  isBusy: getMarkingAutoSyncSettingsPersistBusy,
});
