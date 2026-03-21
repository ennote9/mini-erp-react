import type { PurchaseOrder, PurchaseOrderLine } from "./model";
import { todayYYYYMMDD } from "./dateUtils";
import { itemRepository } from "../items/repository";
import { roundMoney } from "../../shared/commercialMoney";
import type { PlanningDocumentStatus } from "../../shared/domain";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../../shared/documentPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import {
  isCancelDocumentReasonCode,
  zeroPriceReasonCodeForStore,
} from "../../shared/reasonCodes";

export type CreatePurchaseOrderHeaderInput = Omit<
  PurchaseOrder,
  "id" | "number"
>;
export type PurchaseOrderLineInput = {
  itemId: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode?: string;
};
export type UpdatePurchaseOrderPatch = Partial<
  Omit<PurchaseOrder, "id" | "number">
>;

const headerStore: PurchaseOrder[] = [];
const lineStore: PurchaseOrderLine[] = [];
let headerNextId = 1;
let lineNextId = 1;
let numberCounter = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getDocumentsFilePath("purchase-orders.json");

type PurchaseOrderPersistRecord = PurchaseOrder & {
  lines: PurchaseOrderLine[];
};

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asOptionalPaymentTermsDays(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.trunc(v);
  if (n < 0) return undefined;
  return n;
}

function isPlanningStatus(v: unknown): v is PlanningDocumentStatus {
  return v === "draft" || v === "confirmed" || v === "closed" || v === "cancelled";
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function computeNextPONumberCounter(records: PurchaseOrder[]): number {
  let max = 0;
  for (const r of records) {
    const m = /^PO-(\d+)$/.exec(r.number);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function normalizeLine(raw: unknown): PurchaseOrderLine | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.purchaseOrderId !== "string" ||
    typeof rec.itemId !== "string" ||
    typeof rec.qty !== "number" ||
    !Number.isFinite(rec.qty) ||
    typeof rec.unitPrice !== "number" ||
    !Number.isFinite(rec.unitPrice)
  ) {
    return null;
  }
  const unitPrice = roundMoney(rec.unitPrice as number);
  const zpr = zeroPriceReasonCodeForStore(unitPrice, rec.zeroPriceReasonCode);
  const line: PurchaseOrderLine = {
    id: rec.id,
    purchaseOrderId: rec.purchaseOrderId,
    itemId: rec.itemId,
    qty: rec.qty,
    unitPrice,
  };
  if (zpr !== undefined) line.zeroPriceReasonCode = zpr;
  return line;
}

function normalizePORecord(raw: unknown): PurchaseOrderPersistRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.number !== "string" ||
    typeof rec.date !== "string" ||
    typeof rec.supplierId !== "string" ||
    typeof rec.warehouseId !== "string" ||
    !isPlanningStatus(rec.status) ||
    !Array.isArray(rec.lines)
  ) {
    return null;
  }
  const lines = rec.lines.map(normalizeLine).filter((x): x is PurchaseOrderLine => x !== null);
  if (rec.lines.length > 0 && lines.length === 0) return null;
  return {
    id: rec.id,
    number: rec.number,
    date: rec.date,
    supplierId: rec.supplierId,
    warehouseId: rec.warehouseId,
    status: rec.status,
    paymentTermsDays: asOptionalPaymentTermsDays(rec.paymentTermsDays),
    dueDate: asOptionalString(rec.dueDate),
    comment: asOptionalString(rec.comment),
    cancelReasonCode:
      typeof rec.cancelReasonCode === "string" && isCancelDocumentReasonCode(rec.cancelReasonCode)
        ? rec.cancelReasonCode
        : undefined,
    cancelReasonComment: asOptionalString(rec.cancelReasonComment),
    lines,
  };
}

function buildSeedRecords(): PurchaseOrderPersistRecord[] {
  const seedItem = itemRepository.getById("1");
  const seeded: PurchaseOrderPersistRecord[] = [
    {
      id: "1",
      number: "PO-000001",
      date: todayYYYYMMDD(),
      supplierId: "1",
      warehouseId: "1",
      status: "draft",
      comment: "",
      lines: [
        {
          id: "1",
          purchaseOrderId: "1",
          itemId: "1",
          qty: 10,
          unitPrice: seedItem?.purchasePrice ?? 0,
        },
      ],
    },
  ];
  return seeded;
}

function snapshotPersistRecords(): PurchaseOrderPersistRecord[] {
  return headerStore.map((header) => ({
    ...header,
    lines: lineStore.filter((l) => l.purchaseOrderId === header.id).map((l) => ({ ...l })),
  }));
}

export function getPurchaseOrderPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastPurchaseOrderPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingPurchaseOrderPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function schedulePersist(): void {
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeDocumentPayload(PERSIST_PATH, snapshotPersistRecords());
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[purchaseOrderRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

function nextHeaderId(): string {
  return String(headerNextId++);
}
function nextLineId(): string {
  return String(lineNextId++);
}
function nextNumber(): string {
  return `PO-${String(numberCounter++).padStart(6, "0")}`;
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizePORecord,
    diagnosticsTag: "purchaseOrderRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  const headers = loaded.records.map(({ lines: _lines, ...header }) => header);
  const lines = loaded.records.flatMap((record) => record.lines.map((line) => ({ ...line })));
  headerStore.splice(0, headerStore.length, ...headers);
  lineStore.splice(0, lineStore.length, ...lines);
  headerNextId = computeNextNumericId(headerStore);
  lineNextId = computeNextNumericId(lineStore);
  numberCounter = computeNextPONumberCounter(headerStore);
}

export const purchaseOrderRepository = {
  list(): PurchaseOrder[] {
    return [...headerStore];
  },

  getById(id: string): PurchaseOrder | undefined {
    return headerStore.find((x) => x.id === id);
  },

  listLines(documentId: string): PurchaseOrderLine[] {
    return lineStore.filter((x) => x.purchaseOrderId === documentId);
  },

  create(
    header: CreatePurchaseOrderHeaderInput,
    lines: PurchaseOrderLineInput[],
  ): PurchaseOrder {
    const id = nextHeaderId();
    const number = nextNumber();
    const doc: PurchaseOrder = {
      ...header,
      id,
      number,
      status: header.status ?? "draft",
    };
    headerStore.push(doc);
    for (const l of lines) {
      const unitPrice = roundMoney(
        typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0,
      );
      const zpr = zeroPriceReasonCodeForStore(unitPrice, l.zeroPriceReasonCode);
      const row: PurchaseOrderLine = {
        id: nextLineId(),
        purchaseOrderId: id,
        itemId: l.itemId,
        qty: l.qty,
        unitPrice,
      };
      if (zpr !== undefined) row.zeroPriceReasonCode = zpr;
      lineStore.push(row);
    }
    schedulePersist();
    return doc;
  },

  update(id: string, patch: UpdatePurchaseOrderPatch): PurchaseOrder | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
    schedulePersist();
    return headerStore[i];
  },

  replaceLines(
    documentId: string,
    lines: PurchaseOrderLineInput[],
  ): PurchaseOrderLine[] {
    const existing = lineStore.filter((x) => x.purchaseOrderId !== documentId);
    lineStore.length = 0;
    lineStore.push(...existing);
    const newLines: PurchaseOrderLine[] = [];
    for (const l of lines) {
      const unitPrice = roundMoney(
        typeof l.unitPrice === "number" && !Number.isNaN(l.unitPrice) ? l.unitPrice : 0,
      );
      const zpr = zeroPriceReasonCodeForStore(unitPrice, l.zeroPriceReasonCode);
      const line: PurchaseOrderLine = {
        id: nextLineId(),
        purchaseOrderId: documentId,
        itemId: l.itemId,
        qty: l.qty,
        unitPrice,
      };
      if (zpr !== undefined) line.zeroPriceReasonCode = zpr;
      lineStore.push(line);
      newLines.push(line);
    }
    schedulePersist();
    return newLines;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "purchase-orders",
  flush: flushPendingPurchaseOrderPersist,
  isBusy: getPurchaseOrderPersistBusy,
});
