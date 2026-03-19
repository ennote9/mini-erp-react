import type { StockBalance } from "./model";
import {
  getInventoryFilePath,
  loadInventoryPersisted,
  writeInventoryPayload,
} from "../../shared/inventoryPersistence";

export type UpsertStockBalanceInput = Omit<StockBalance, "id">;

const store: StockBalance[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getInventoryFilePath("stock-balances.json");

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeStockBalance(raw: unknown): StockBalance | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const qtyOnHand = asFiniteNumber(rec.qtyOnHand);
  if (
    typeof rec.id !== "string" ||
    typeof rec.itemId !== "string" ||
    typeof rec.warehouseId !== "string" ||
    qtyOnHand === null
  ) {
    return null;
  }
  return {
    id: rec.id,
    itemId: rec.itemId,
    warehouseId: rec.warehouseId,
    qtyOnHand,
  };
}

function buildSeedRecords(): StockBalance[] {
  return [{ id: "1", itemId: "1", warehouseId: "1", qtyOnHand: 0 }];
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function getStockBalancePersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastStockBalancePersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingStockBalancePersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function schedulePersist(): void {
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeInventoryPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[stockBalanceRepository] persist failed:", e);
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
  const loaded = await loadInventoryPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizeStockBalance,
    diagnosticsTag: "stockBalanceRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

let closeHookRegistered = false;

function registerStockBalancePersistCloseHook(): void {
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
          await flushPendingStockBalancePersist();
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error("[stockBalanceRepository] flush on window close failed:", e);
          }
        }
        closingAfterFlush = true;
        await w.close();
      });
    } catch {
      // Not running in Tauri.
    }
  })();
}

export const stockBalanceRepository = {
  list(): StockBalance[] {
    return [...store];
  },

  getByItemAndWarehouse(
    itemId: string,
    warehouseId: string,
  ): StockBalance | undefined {
    return store.find(
      (x) => x.itemId === itemId && x.warehouseId === warehouseId,
    );
  },

  /** Insert or replace balance for item+warehouse. Foundation for future post logic. */
  upsert(data: UpsertStockBalanceInput): StockBalance {
    const i = store.findIndex(
      (x) => x.itemId === data.itemId && x.warehouseId === data.warehouseId,
    );
    if (i >= 0) {
      store[i] = { ...data, id: store[i].id };
      schedulePersist();
      return store[i];
    }
    const balance: StockBalance = { ...data, id: nextIdStr() };
    store.push(balance);
    schedulePersist();
    return balance;
  },
};

await bootstrapFromDisk();
registerStockBalancePersistCloseHook();
