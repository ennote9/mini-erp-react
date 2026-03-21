import type { Receipt, ReceiptLine } from "./model";
import type { FactualDocumentStatus } from "../../shared/domain";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../../shared/documentPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import {
  isCancelDocumentReasonCode,
  isReversalDocumentReasonCode,
} from "../../shared/reasonCodes";

export type CreateReceiptHeaderInput = Omit<Receipt, "id" | "number">;
export type ReceiptLineInput = { itemId: string; qty: number };
export type UpdateReceiptPatch = Partial<Omit<Receipt, "id" | "number">>;

const headerStore: Receipt[] = [];
const lineStore: ReceiptLine[] = [];
let headerNextId = 1;
let lineNextId = 1;
let numberCounter = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getDocumentsFilePath("receipts.json");

type ReceiptPersistRecord = Receipt & {
  lines: ReceiptLine[];
};

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isFactualStatus(v: unknown): v is FactualDocumentStatus {
  return (
    v === "draft" || v === "posted" || v === "cancelled" || v === "reversed"
  );
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function computeNextReceiptNumberCounter(records: Receipt[]): number {
  let max = 0;
  for (const r of records) {
    const m = /^RCPT-(\d+)$/.exec(r.number);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function normalizeLine(raw: unknown): ReceiptLine | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.receiptId !== "string" ||
    typeof rec.itemId !== "string" ||
    typeof rec.qty !== "number" ||
    !Number.isFinite(rec.qty)
  ) {
    return null;
  }
  return {
    id: rec.id,
    receiptId: rec.receiptId,
    itemId: rec.itemId,
    qty: rec.qty,
  };
}

function normalizeReceiptRecord(raw: unknown): ReceiptPersistRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.number !== "string" ||
    typeof rec.date !== "string" ||
    typeof rec.purchaseOrderId !== "string" ||
    typeof rec.warehouseId !== "string" ||
    !isFactualStatus(rec.status) ||
    !Array.isArray(rec.lines)
  ) {
    return null;
  }
  const lines = rec.lines.map(normalizeLine).filter((x): x is ReceiptLine => x !== null);
  if (rec.lines.length > 0 && lines.length === 0) return null;
  return {
    id: rec.id,
    number: rec.number,
    date: rec.date,
    purchaseOrderId: rec.purchaseOrderId,
    warehouseId: rec.warehouseId,
    status: rec.status,
    comment: asOptionalString(rec.comment),
    cancelReasonCode:
      typeof rec.cancelReasonCode === "string" && isCancelDocumentReasonCode(rec.cancelReasonCode)
        ? rec.cancelReasonCode
        : undefined,
    cancelReasonComment: asOptionalString(rec.cancelReasonComment),
    reversalReasonCode:
      typeof rec.reversalReasonCode === "string" &&
      isReversalDocumentReasonCode(rec.reversalReasonCode)
        ? rec.reversalReasonCode
        : undefined,
    reversalReasonComment: asOptionalString(rec.reversalReasonComment),
    lines,
  };
}

function buildSeedRecords(): ReceiptPersistRecord[] {
  return [];
}

function snapshotPersistRecords(): ReceiptPersistRecord[] {
  return headerStore.map((header) => ({
    ...header,
    lines: lineStore.filter((l) => l.receiptId === header.id).map((l) => ({ ...l })),
  }));
}

export function getReceiptPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastReceiptPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingReceiptPersist(): Promise<void> {
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
          console.error("[receiptRepository] persist failed:", e);
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
  return `RCPT-${String(numberCounter++).padStart(6, "0")}`;
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizeReceiptRecord,
    diagnosticsTag: "receiptRepository",
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
  numberCounter = computeNextReceiptNumberCounter(headerStore);
}

export const receiptRepository = {
  list(): Receipt[] {
    return [...headerStore];
  },

  getById(id: string): Receipt | undefined {
    return headerStore.find((x) => x.id === id);
  },

  listLines(documentId: string): ReceiptLine[] {
    return lineStore.filter((x) => x.receiptId === documentId);
  },

  create(
    header: CreateReceiptHeaderInput,
    lines: ReceiptLineInput[],
  ): Receipt {
    const id = nextHeaderId();
    const number = nextNumber();
    const doc: Receipt = {
      ...header,
      id,
      number,
      status: header.status ?? "draft",
    };
    headerStore.push(doc);
    for (const l of lines) {
      lineStore.push({
        id: nextLineId(),
        receiptId: id,
        itemId: l.itemId,
        qty: l.qty,
      });
    }
    schedulePersist();
    return doc;
  },

  update(id: string, patch: UpdateReceiptPatch): Receipt | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
    schedulePersist();
    return headerStore[i];
  },

  replaceLines(
    documentId: string,
    lines: ReceiptLineInput[],
  ): ReceiptLine[] {
    const existing = lineStore.filter((x) => x.receiptId !== documentId);
    lineStore.length = 0;
    lineStore.push(...existing);
    const newLines: ReceiptLine[] = [];
    for (const l of lines) {
      const line: ReceiptLine = {
        id: nextLineId(),
        receiptId: documentId,
        itemId: l.itemId,
        qty: l.qty,
      };
      lineStore.push(line);
      newLines.push(line);
    }
    schedulePersist();
    return newLines;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "receipts",
  flush: flushPendingReceiptPersist,
  isBusy: getReceiptPersistBusy,
});
