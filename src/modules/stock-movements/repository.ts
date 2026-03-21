import type { StockMovement } from "./model";
import type { MovementType, SourceDocumentType } from "../../shared/domain";
import {
  getInventoryFilePath,
  loadInventoryPersisted,
  writeInventoryPayload,
} from "../../shared/inventoryPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";

export type CreateStockMovementInput = Omit<StockMovement, "id">;

const store: StockMovement[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getInventoryFilePath("stock-movements.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isMovementType(v: unknown): v is MovementType {
  return (
    v === "receipt" ||
    v === "shipment" ||
    v === "receipt_reversal" ||
    v === "shipment_reversal"
  );
}

function isSourceDocumentType(v: unknown): v is SourceDocumentType {
  return v === "receipt" || v === "shipment";
}

function normalizeStockMovement(raw: unknown): StockMovement | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const qtyDelta = asFiniteNumber(rec.qtyDelta);
  if (
    typeof rec.id !== "string" ||
    typeof rec.datetime !== "string" ||
    !isMovementType(rec.movementType) ||
    typeof rec.itemId !== "string" ||
    typeof rec.warehouseId !== "string" ||
    qtyDelta === null ||
    !isSourceDocumentType(rec.sourceDocumentType) ||
    typeof rec.sourceDocumentId !== "string"
  ) {
    return null;
  }
  return {
    id: rec.id,
    datetime: rec.datetime,
    movementType: rec.movementType,
    itemId: rec.itemId,
    warehouseId: rec.warehouseId,
    qtyDelta,
    sourceDocumentType: rec.sourceDocumentType,
    sourceDocumentId: rec.sourceDocumentId,
    comment: asOptionalString(rec.comment),
  };
}

function buildSeedRecords(): StockMovement[] {
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

export function getStockMovementPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastStockMovementPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingStockMovementPersist(): Promise<void> {
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
          console.error("[stockMovementRepository] persist failed:", e);
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
    normalizeRecord: normalizeStockMovement,
    diagnosticsTag: "stockMovementRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

export const stockMovementRepository = {
  list(): StockMovement[] {
    return [...store];
  },

  /** Append a movement. Foundation for future post logic. */
  create(input: CreateStockMovementInput): StockMovement {
    const movement: StockMovement = { ...input, id: nextIdStr() };
    store.push(movement);
    schedulePersist();
    return movement;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "stock-movements",
  flush: flushPendingStockMovementPersist,
  isBusy: getStockMovementPersistBusy,
});
