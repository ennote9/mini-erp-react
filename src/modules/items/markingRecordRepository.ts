import type { ItemMarkingRecord } from "./model/itemMarkingRecord";
import { loadItemMarkingRecordsPersisted, writeItemMarkingRecordsPayload } from "./lib/markingRecordsPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

const store: ItemMarkingRecord[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
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
        await writeItemMarkingRecordsPayload([...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[markingRecordRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getMarkingRecordPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingMarkingRecordPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

export type CreateItemMarkingRecordInput = Omit<ItemMarkingRecord, "id" | "createdAt" | "updatedAt">;

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadItemMarkingRecordsPersisted();
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

export const markingRecordRepository = {
  list(): ItemMarkingRecord[] {
    return [...store];
  },

  listByItemId(itemId: string): ItemMarkingRecord[] {
    return store.filter((r) => r.itemId === itemId).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  getById(id: string): ItemMarkingRecord | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateItemMarkingRecordInput): ItemMarkingRecord {
    const ts = new Date().toISOString();
    const entity: ItemMarkingRecord = {
      ...input,
      id: String(nextId++),
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: Partial<Omit<ItemMarkingRecord, "id" | "createdAt">>): ItemMarkingRecord | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const prev = store[i];
    store[i] = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    };
    schedulePersist();
    return store[i];
  },

  remove(id: string): boolean {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return false;
    store.splice(i, 1);
    schedulePersist();
    return true;
  },
};

await bootstrapFromDisk();

registerPersistenceFlush({
  id: "item-marking-records",
  flush: flushPendingMarkingRecordPersist,
  isBusy: getMarkingRecordPersistBusy,
});
