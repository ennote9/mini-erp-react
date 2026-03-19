import type { Item, ItemImage } from "./model";
import { buildSeedItems } from "./itemsSeedData";
import {
  loadItemsPersisted,
  writeItemsPayload,
  getItemsPersistenceDiagnostics,
} from "./lib/itemsPersistence";

export type CreateItemInput = Omit<Item, "id" | "images"> & { images?: ItemImage[] };
export type UpdateItemPatch = Partial<Omit<Item, "id">>;

const store: Item[] = [];
let nextId = 1;

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

async function bootstrapFromDisk(): Promise<void> {
  const { items, nextId: loadedNext } = await loadItemsPersisted(buildSeedItems);
  store.splice(0, store.length, ...items);
  nextId = loadedNext;
}

let closeHookRegistered = false;

/**
 * Flush pending item JSON writes before the main window closes (Tauri).
 * Uses preventDefault + programmatic close so async flush can finish.
 */
function registerItemsPersistCloseHook(): void {
  if (closeHookRegistered) return;
  closeHookRegistered = true;
  void (async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      let closingAfterFlush = false;
      await w.onCloseRequested(async (event) => {
        if (closingAfterFlush) return;
        event.preventDefault();
        try {
          await flushPendingItemsPersist();
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error("[itemRepository] flush on window close failed:", e);
          }
        }
        closingAfterFlush = true;
        await w.close();
      });
    } catch {
      /* Not running inside Tauri webview (e.g. plain Vite in browser). */
    }
  })();
}

await bootstrapFromDisk();
registerItemsPersistCloseHook();

export { getItemsPersistenceDiagnostics };

export const itemRepository = {
  list(): Item[] {
    return [...store];
  },

  getById(id: string): Item | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateItemInput): Item {
    const item: Item = {
      ...input,
      id: nextIdStr(),
      images: input.images ?? [],
    };
    store.push(item);
    schedulePersist();
    return item;
  },

  update(id: string, patch: UpdateItemPatch): Item | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
    return store[i];
  },

  search(query: string): Item[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};
