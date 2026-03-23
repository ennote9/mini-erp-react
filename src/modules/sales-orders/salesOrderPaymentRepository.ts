import type { CustomerPaymentMethod, SalesOrderPaymentRecord } from "./salesOrderPaymentModel";
import { CUSTOMER_PAYMENT_METHOD_CODES } from "./salesOrderPaymentModel";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../../shared/documentPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";
import { roundMoney } from "../../shared/commercialMoney";

const PERSIST_PATH = getDocumentsFilePath("sales-order-payments.json");

const store: SalesOrderPaymentRecord[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

function isMethod(v: unknown): v is CustomerPaymentMethod {
  return typeof v === "string" && (CUSTOMER_PAYMENT_METHOD_CODES as string[]).includes(v);
}

function normalizePayment(raw: unknown): SalesOrderPaymentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const amount =
    typeof rec.amount === "number" && Number.isFinite(rec.amount) ? roundMoney(rec.amount) : null;
  if (
    typeof rec.id !== "string" ||
    typeof rec.salesOrderId !== "string" ||
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
  const row: SalesOrderPaymentRecord = {
    id: rec.id,
    salesOrderId: rec.salesOrderId,
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

function buildSeedRecords(): SalesOrderPaymentRecord[] {
  return [];
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const r of records) {
    const n = Number.parseInt(r.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function getSalesOrderPaymentPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastSalesOrderPaymentPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingSalesOrderPaymentPersist(): Promise<void> {
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
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[salesOrderPaymentRepository] persist failed:", e);
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
    diagnosticsTag: "salesOrderPaymentRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

export const salesOrderPaymentRepository = {
  list(): SalesOrderPaymentRecord[] {
    return [...store];
  },

  listBySalesOrderId(salesOrderId: string): SalesOrderPaymentRecord[] {
    return store.filter((p) => p.salesOrderId === salesOrderId).sort((a, b) => {
      const ta = new Date(a.paidAt).getTime();
      const tb = new Date(b.paidAt).getTime();
      if (ta !== tb) return tb - ta;
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    });
  },

  create(
    input: Omit<SalesOrderPaymentRecord, "id" | "createdAt" | "updatedAt">,
  ): SalesOrderPaymentRecord {
    const now = new Date().toISOString();
    const rec: SalesOrderPaymentRecord = {
      ...input,
      id: nextIdStr(),
      amount: roundMoney(input.amount),
      createdAt: now,
      updatedAt: now,
    };
    store.push(rec);
    schedulePersist();
    return rec;
  },

  delete(id: string): boolean {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return false;
    store.splice(i, 1);
    schedulePersist();
    return true;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "sales-order-payments",
  flush: flushPendingSalesOrderPaymentPersist,
  isBusy: getSalesOrderPaymentPersistBusy,
});
