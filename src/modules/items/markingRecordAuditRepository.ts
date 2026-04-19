import type { ItemMarkingRecordAuditEntry } from "./model/itemMarkingRecordAudit";
import { loadMarkingRecordAuditPersisted, writeMarkingRecordAuditPayload } from "./lib/markingRecordAuditPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

const store: ItemMarkingRecordAuditEntry[] = [];
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
        await writeMarkingRecordAuditPayload([...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[markingRecordAuditRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getMarkingRecordAuditPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingMarkingRecordAuditPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMarkingRecordAuditPersisted();
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.entries);
  nextId = computeNextNumericId(store);
}

export type CreateItemMarkingRecordAuditInput = Omit<ItemMarkingRecordAuditEntry, "id" | "createdAt">;

export const markingRecordAuditRepository = {
  list(): ItemMarkingRecordAuditEntry[] {
    return [...store];
  },

  listByMarkingRecordId(markingRecordId: string): ItemMarkingRecordAuditEntry[] {
    return store
      .filter((e) => e.markingRecordId === markingRecordId)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  append(input: CreateItemMarkingRecordAuditInput): ItemMarkingRecordAuditEntry {
    const ts = new Date().toISOString();
    const entity: ItemMarkingRecordAuditEntry = {
      ...input,
      id: String(nextId++),
      createdAt: ts,
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },
};

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "marking-record-audit",
  flush: flushPendingMarkingRecordAuditPersist,
  isBusy: getMarkingRecordAuditPersistBusy,
});
