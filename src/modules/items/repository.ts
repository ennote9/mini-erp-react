import type { Item, ItemImage } from "./model";
import { buildSeedItems } from "./itemsSeedData";
import { itemBarcodeTokensForMasterSearch } from "./lib/itemBarcodeLookup";
import {
  loadItemsPersisted,
  writeItemsPayload,
  getItemsPersistenceDiagnostics,
} from "./lib/itemsPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";
import {
  bridgeLegacyBarcodeValueFromCollection,
  normalizeItemBarcodesCollection,
} from "./lib/itemBarcodes";

export type CreateItemInput = Omit<Item, "id" | "images" | "barcodes"> & {
  images?: ItemImage[];
  barcodes?: Item["barcodes"];
};
export type UpdateItemPatch = Partial<Omit<Item, "id">>;

const store: Item[] = [];
let nextId = 1;
let itemsReady = false;
let itemsLoadPromise: Promise<void> | null = null;

/** Serialized disk writes: each scheduled job snapshots the current store and writes once. */
let persistChain: Promise<void> = Promise.resolve();

/** Number of persist jobs queued or currently running (increment per schedule, decrement in finally). */
let persistDepth = 0;

let lastWriteError: string | null = null;

/** Last failed save error (e.g. permission / disk); dev-friendly string. */
export function getLastItemRepositoryPersistError(): string | null {
  return lastWriteError;
}

/** True while at least one items.json write is queued or in flight. */
export function getItemsPersistBusy(): boolean {
  return persistDepth > 0;
}

/**
 * Await completion of all queued item persistence writes, then rethrow if the last write failed.
 * Safe to call when idle (resolves immediately).
 */
export async function flushPendingItemsPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) {
    throw new Error(lastWriteError);
  }
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeItemsPayload([...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[itemRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

function nextIdStr(): string {
  return String(nextId++);
}

function buildCreatedItem(input: CreateItemInput): Item {
  const normalizedBarcodes = normalizeItemBarcodesCollection(input.barcodes ?? []);
  return {
    ...input,
    id: nextIdStr(),
    images: input.images ?? [],
    barcodes: normalizedBarcodes,
    barcode: bridgeLegacyBarcodeValueFromCollection(normalizedBarcodes),
    itemKind: input.itemKind ?? "SELLABLE",
  };
}

async function bootstrapFromDisk(): Promise<void> {
  const { items, nextId: loadedNext } = await loadItemsPersisted(buildSeedItems);
  store.splice(0, store.length, ...items);
  nextId = loadedNext;
  itemsReady = true;
}

export function isItemsRepositoryReady(): boolean {
  return itemsReady;
}

export function ensureItemsLoaded(): Promise<void> {
  if (itemsReady) return Promise.resolve();
  if (!itemsLoadPromise) {
    itemsLoadPromise = bootstrapFromDisk().catch((e) => {
      if (import.meta.env.DEV) {
        console.error("[itemRepository] bootstrap failed:", e);
      }
    }).finally(() => {
      itemsReady = true;
    });
  }
  return itemsLoadPromise;
}
registerPersistenceFlush({
  id: "items",
  flush: flushPendingItemsPersist,
  isBusy: getItemsPersistBusy,
});

export { getItemsPersistenceDiagnostics };

export const itemRepository = {
  list(): Item[] {
    void ensureItemsLoaded();
    return [...store];
  },

  getById(id: string): Item | undefined {
    void ensureItemsLoaded();
    return store.find((x) => x.id === id);
  },

  create(input: CreateItemInput): Item {
    void ensureItemsLoaded();
    const item = buildCreatedItem(input);
    store.push(item);
    schedulePersist();
    return item;
  },

  createTesterWithBaseSequence(
    input: CreateItemInput,
    baseItemId: string,
    nextTesterCodeNextSeq: number,
  ): Item | undefined {
    void ensureItemsLoaded();
    const baseIndex = store.findIndex((x) => x.id === baseItemId);
    if (baseIndex === -1) return undefined;
    const base = store[baseIndex];
    const created = buildCreatedItem(input);
    store.push(created);
    store[baseIndex] = {
      ...base,
      testerCodeNextSeq: nextTesterCodeNextSeq,
    };
    schedulePersist();
    return created;
  },

  update(id: string, patch: UpdateItemPatch): Item | undefined {
    void ensureItemsLoaded();
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const merged = { ...store[i], ...patch };
    const normalizedBarcodes = normalizeItemBarcodesCollection(merged.barcodes ?? []);
    store[i] = {
      ...merged,
      barcodes: normalizedBarcodes,
      barcode: bridgeLegacyBarcodeValueFromCollection(normalizedBarcodes),
    };
    schedulePersist();
    return store[i];
  },

  search(query: string): Item[] {
    void ensureItemsLoaded();
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) ||
        x.name.toLowerCase().includes(q) ||
        itemBarcodeTokensForMasterSearch(x).some((token) => token.includes(q)),
    );
  },
};
