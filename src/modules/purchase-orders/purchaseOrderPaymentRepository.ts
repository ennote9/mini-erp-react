import type {
  PurchaseOrderPaymentRecord,
  SupplierPaymentMethod,
} from "./purchaseOrderPaymentModel";
import { SUPPLIER_PAYMENT_METHOD_CODES } from "./purchaseOrderPaymentModel";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../../shared/documentPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";
import { roundMoney } from "../../shared/commercialMoney";

const PERSIST_PATH = getDocumentsFilePath("purchase-order-payments.json");

const store: PurchaseOrderPaymentRecord[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function isMethod(v: unknown): v is SupplierPaymentMethod {
  return typeof v === "string" && (SUPPLIER_PAYMENT_METHOD_CODES as string[]).includes(v);
}

function normalizePayment(raw: unknown): PurchaseOrderPaymentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const amount =
    typeof rec.amount === "number" && Number.isFinite(rec.amount) ? roundMoney(rec.amount) : null;
  if (
    typeof rec.id !== "string" ||
    typeof rec.purchaseOrderId !== "string" ||
    amount === null ||
    amount <= 0 ||
    typeof rec.paidAt !== "string" ||
    rec.paidAt.trim() === "" ||
    !isMethod(rec.method) ||
    typeof rec.createdAt !== "string" ||
    typeof rec.updatedAt !== "string"
  ) {
    return null;
  }
  const row: PurchaseOrderPaymentRecord = {
    id: rec.id,
    purchaseOrderId: rec.purchaseOrderId,
    amount,
    paidAt: rec.paidAt.trim(),
    method: rec.method,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
  if (typeof rec.reference === "string" && rec.reference.trim() !== "") {
    row.reference = rec.reference.trim();
  }
  if (typeof rec.comment === "string" && rec.comment.trim() !== "") {
    row.comment = rec.comment.trim();
  }
  return row;
}

function buildSeedRecords(): PurchaseOrderPaymentRecord[] {
  return [];
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const record of records) {
    const n = Number.parseInt(record.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function getPurchaseOrderPaymentPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastPurchaseOrderPaymentPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingPurchaseOrderPaymentPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeDocumentPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (error) {
        lastWriteError = error instanceof Error ? error.message : String(error);
        if (import.meta.env.DEV) {
          console.error("[purchaseOrderPaymentRepository] persist failed:", error);
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
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizePayment,
    diagnosticsTag: "purchaseOrderPaymentRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

export const purchaseOrderPaymentRepository = {
  list(): PurchaseOrderPaymentRecord[] {
    return [...store];
  },

  listByPurchaseOrderId(purchaseOrderId: string): PurchaseOrderPaymentRecord[] {
    return store
      .filter((payment) => payment.purchaseOrderId === purchaseOrderId)
      .sort((a, b) => {
        const ta = new Date(a.paidAt).getTime();
        const tb = new Date(b.paidAt).getTime();
        if (ta !== tb) return tb - ta;
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      });
  },

  create(
    input: Omit<PurchaseOrderPaymentRecord, "id" | "createdAt" | "updatedAt">,
  ): PurchaseOrderPaymentRecord {
    const now = new Date().toISOString();
    const record: PurchaseOrderPaymentRecord = {
      ...input,
      id: nextIdStr(),
      amount: roundMoney(input.amount),
      createdAt: now,
      updatedAt: now,
    };
    store.push(record);
    schedulePersist();
    return record;
  },

  delete(id: string): boolean {
    const i = store.findIndex((record) => record.id === id);
    if (i === -1) return false;
    store.splice(i, 1);
    schedulePersist();
    return true;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "purchase-order-payments",
  flush: flushPendingPurchaseOrderPaymentPersist,
  isBusy: getPurchaseOrderPaymentPersistBusy,
});
