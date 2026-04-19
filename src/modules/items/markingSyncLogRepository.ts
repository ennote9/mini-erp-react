import type { MarkingSyncLogEntry } from "./model/markingExternalSync";
import { loadMarkingSyncLogPersisted, writeMarkingSyncLogPayload } from "./lib/markingSyncLogPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

const store: MarkingSyncLogEntry[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function computeNextNumericId(entries: Array<{ id: string }>): number {
  let max = 0;
  for (const e of entries) {
    const n = Number.parseInt(e.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMarkingSyncLogPayload([...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[markingSyncLogRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getMarkingSyncLogPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingMarkingSyncLogPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMarkingSyncLogPersisted();
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.entries);
  nextId = computeNextNumericId(store);
}

export const markingSyncLogRepository = {
  list(): MarkingSyncLogEntry[] {
    return [...store];
  },

  /** Newest first. */
  listRecent(limit = 80): MarkingSyncLogEntry[] {
    return [...store].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, limit);
  },

  getById(id: string): MarkingSyncLogEntry | undefined {
    return store.find((e) => e.id === id);
  },

  append(entry: Omit<MarkingSyncLogEntry, "id">): MarkingSyncLogEntry {
    const entity: MarkingSyncLogEntry = {
      ...entry,
      id: String(nextId++),
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },
};

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "marking-sync-log",
  flush: flushPendingMarkingSyncLogPersist,
  isBusy: getMarkingSyncLogPersistBusy,
});
