import type { StockReservation, StockReservationStatus } from "./model";
import {
  getInventoryFilePath,
  loadInventoryPersisted,
  writeInventoryPayload,
} from "../../shared/inventoryPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";
import { normalizeTrim } from "../../shared/validation";

const PERSIST_PATH = getInventoryFilePath("stock-reservations.json");

const store: StockReservation[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function isStatus(v: unknown): v is StockReservationStatus {
  return v === "active" || v === "consumed" || v === "released";
}

function normalizeReservation(raw: unknown): StockReservation | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const qty = typeof rec.qty === "number" && Number.isFinite(rec.qty) ? rec.qty : null;
  if (
    typeof rec.id !== "string" ||
    typeof rec.warehouseId !== "string" ||
    typeof rec.itemId !== "string" ||
    typeof rec.salesOrderId !== "string" ||
    typeof rec.salesOrderLineId !== "string" ||
    qty === null ||
    qty < 0 ||
    !isStatus(rec.status) ||
    typeof rec.createdAt !== "string" ||
    typeof rec.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id: rec.id,
    warehouseId: rec.warehouseId,
    itemId: rec.itemId,
    salesOrderId: rec.salesOrderId,
    salesOrderLineId: rec.salesOrderLineId,
    qty,
    status: rec.status,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

function buildSeedRecords(): StockReservation[] {
  return [];
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function getStockReservationPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastStockReservationPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingStockReservationPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
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
        if (import.meta.env.DEV) {
          console.error("[stockReservationRepository] persist failed:", e);
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
    normalizeRecord: normalizeReservation,
    diagnosticsTag: "stockReservationRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

function touch(rec: StockReservation): void {
  rec.updatedAt = new Date().toISOString();
}

export const stockReservationRepository = {
  list(): StockReservation[] {
    return [...store];
  },

  /** Sum of active reservation qty for warehouse + item (all sales orders). */
  sumActiveQtyForWarehouseItem(warehouseId: string, itemId: string): number {
    let s = 0;
    for (const r of store) {
      if (r.status !== "active") continue;
      if (r.warehouseId !== warehouseId || r.itemId !== itemId) continue;
      s += r.qty;
    }
    return s;
  },

  /** Active qty for one SO line (at most one active row per line in MVP). */
  getActiveQtyForSalesOrderLine(salesOrderId: string, salesOrderLineId: string): number {
    for (const r of store) {
      if (r.status !== "active") continue;
      if (r.salesOrderId !== salesOrderId || r.salesOrderLineId !== salesOrderLineId) continue;
      return r.qty;
    }
    return 0;
  },

  /** All active reservations for a sales order (any line/item). */
  listActiveForSalesOrder(salesOrderId: string): StockReservation[] {
    return store.filter((r) => r.status === "active" && r.salesOrderId === salesOrderId).slice();
  },

  /**
   * Active reservations for SO + item, sorted by line id for deterministic consume.
   * When warehouseId is set, only rows for that warehouse count (posting integrity).
   */
  listActiveForSalesOrderItem(
    salesOrderId: string,
    itemId: string,
    warehouseId?: string,
  ): StockReservation[] {
    const wh = warehouseId !== undefined ? normalizeTrim(warehouseId) : "";
    const whFilter = warehouseId !== undefined;
    return store
      .filter(
        (r) =>
          r.status === "active" &&
          r.salesOrderId === salesOrderId &&
          r.itemId === itemId &&
          (!whFilter || normalizeTrim(r.warehouseId) === wh),
      )
      .slice()
      .sort((a, b) => a.salesOrderLineId.localeCompare(b.salesOrderLineId, undefined, { numeric: true }));
  },

  /** Sum active qty for SO + item; optional warehouse scopes to that warehouse only. */
  sumActiveQtyForSalesOrderItem(
    salesOrderId: string,
    itemId: string,
    warehouseId?: string,
  ): number {
    const wh = warehouseId !== undefined ? normalizeTrim(warehouseId) : "";
    const whFilter = warehouseId !== undefined;
    let s = 0;
    for (const r of store) {
      if (r.status !== "active") continue;
      if (r.salesOrderId !== salesOrderId || r.itemId !== itemId) continue;
      if (whFilter && normalizeTrim(r.warehouseId) !== wh) continue;
      s += r.qty;
    }
    return s;
  },

  /** Release one active row by id (status released, qty 0). */
  releaseActiveReservationById(reservationId: string): boolean {
    const idx = store.findIndex((r) => r.id === reservationId && r.status === "active");
    if (idx < 0) return false;
    const now = new Date().toISOString();
    store[idx] = {
      ...store[idx],
      qty: 0,
      status: "released",
      updatedAt: now,
    };
    schedulePersist();
    return true;
  },

  /**
   * Set active reservation qty for a line. qty 0 → released row removed from active pool (status released, qty 0).
   */
  upsertActiveForSalesOrderLine(input: {
    salesOrderId: string;
    salesOrderLineId: string;
    warehouseId: string;
    itemId: string;
    qty: number;
  }): void {
    const now = new Date().toISOString();
    const { salesOrderId, salesOrderLineId, warehouseId, itemId } = input;
    let qty = Math.max(0, input.qty);
    if (!Number.isFinite(qty)) qty = 0;

    const idx = store.findIndex(
      (r) =>
        r.salesOrderId === salesOrderId &&
        r.salesOrderLineId === salesOrderLineId &&
        r.status === "active",
    );

    if (qty === 0) {
      if (idx >= 0) {
        store[idx] = {
          ...store[idx],
          qty: 0,
          status: "released",
          updatedAt: now,
        };
        schedulePersist();
      }
      return;
    }

    if (idx >= 0) {
      const rec = store[idx];
      rec.qty = qty;
      rec.warehouseId = warehouseId;
      rec.itemId = itemId;
      touch(rec);
      schedulePersist();
      return;
    }

    store.push({
      id: nextIdStr(),
      warehouseId,
      itemId,
      salesOrderId,
      salesOrderLineId,
      qty,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    schedulePersist();
  },

  /** Mark all active reservations for this sales order as released (qty 0). */
  releaseAllActiveForSalesOrder(salesOrderId: string): number {
    const now = new Date().toISOString();
    let n = 0;
    for (const r of store) {
      if (r.status !== "active" || r.salesOrderId !== salesOrderId) continue;
      r.qty = 0;
      r.status = "released";
      r.updatedAt = now;
      n++;
    }
    if (n > 0) schedulePersist();
    return n;
  },

  /**
   * Reduce active reservations for SO+item by shipQty (FIFO by line id). Returns false if not enough active qty.
   */
  tryConsumeActiveForSalesOrderItem(
    salesOrderId: string,
    itemId: string,
    shipQty: number,
    warehouseId: string,
  ): boolean {
    if (shipQty <= 0) return true;
    let need = shipQty;
    const rows = this.listActiveForSalesOrderItem(salesOrderId, itemId, warehouseId);
    let totalActive = rows.reduce((a, r) => a + r.qty, 0);
    if (totalActive < need) return false;

    const now = new Date().toISOString();
    for (const r of rows) {
      if (need <= 0) break;
      const take = Math.min(need, r.qty);
      if (take <= 0) continue;
      r.qty -= take;
      need -= take;
      if (r.qty <= 0) {
        r.qty = 0;
        r.status = "consumed";
      }
      r.updatedAt = now;
    }
    schedulePersist();
    return need === 0;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "stock-reservations",
  flush: flushPendingStockReservationPersist,
  isBusy: getStockReservationPersistBusy,
});
