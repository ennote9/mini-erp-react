import type { StockBalance } from "./model";
import {
  DEFAULT_STOCK_STYLE,
  normalizeStockStyle,
  type StockStyle,
} from "@/shared/inventoryStyle";
import {
  getInventoryFilePath,
  loadInventoryPersisted,
  writeInventoryPayload,
} from "../../shared/inventoryPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";

export type UpsertStockBalanceInput = Omit<StockBalance, "id" | "style"> & {
  style?: StockStyle;
};
export type AdjustStockBalanceInput = {
  itemId: string;
  warehouseId: string;
  style?: StockStyle;
  qtyDelta: number;
};

const store: StockBalance[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
let pendingWriteErrors: string[] = [];

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
    style: normalizeStockStyle(rec.style),
    qtyOnHand,
  };
}

function buildSeedRecords(): StockBalance[] {
  return [
    {
      id: "1",
      itemId: "1",
      warehouseId: "1",
      style: DEFAULT_STOCK_STYLE,
      qtyOnHand: 0,
    },
  ];
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
  if (pendingWriteErrors.length > 0) {
    const message = pendingWriteErrors.join(" | ");
    pendingWriteErrors = [];
    throw new Error(message);
  }
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeInventoryPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        pendingWriteErrors.push(lastWriteError);
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

export const stockBalanceRepository = {
  list(): StockBalance[] {
    return [...store];
  },

  getById(id: string): StockBalance | undefined {
    return store.find((x) => x.id === id);
  },

  getByItemAndWarehouse(
    itemId: string,
    warehouseId: string,
  ): StockBalance | undefined {
    return store.find(
      (x) =>
        x.itemId === itemId &&
        x.warehouseId === warehouseId &&
        x.style === DEFAULT_STOCK_STYLE,
    );
  },

  getByItemWarehouseAndStyle(
    itemId: string,
    warehouseId: string,
    style: StockStyle,
  ): StockBalance | undefined {
    return store.find(
      (x) =>
        x.itemId === itemId &&
        x.warehouseId === warehouseId &&
        x.style === style,
    );
  },

  /** Insert or replace balance for item+warehouse+style. */
  upsert(data: UpsertStockBalanceInput): StockBalance {
    const style = normalizeStockStyle(data.style);
    const i = store.findIndex(
      (x) =>
        x.itemId === data.itemId &&
        x.warehouseId === data.warehouseId &&
        x.style === style,
    );
    if (i >= 0) {
      store[i] = { ...data, style, id: store[i].id };
      schedulePersist();
      return store[i];
    }
    const balance: StockBalance = { ...data, style, id: nextIdStr() };
    store.push(balance);
    schedulePersist();
    return balance;
  },

  adjustQty(input: AdjustStockBalanceInput): StockBalance {
    const style = normalizeStockStyle(input.style);
    const existing = store.find(
      (x) =>
        x.itemId === input.itemId &&
        x.warehouseId === input.warehouseId &&
        x.style === style,
    );
    const qtyOnHand = Math.max(0, (existing?.qtyOnHand ?? 0) + input.qtyDelta);
    return this.upsert({
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      style,
      qtyOnHand,
    });
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "stock-balances",
  flush: flushPendingStockBalancePersist,
  isBusy: getStockBalancePersistBusy,
});
