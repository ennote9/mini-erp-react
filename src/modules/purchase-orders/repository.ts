import type { PurchaseOrder, PurchaseOrderAttachment, PurchaseOrderLine } from "./model";
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
import { bumpAppReadModelRevision } from "../../shared/appReadModelRevision";
import {
  extractGeneratedVisibleCodeCounter,
  formatGeneratedVisibleCode,
  normalizeGeneratedVisibleCode,
} from "../../shared/generatedVisibleCodes";
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
let attachmentNextId = 1;
let numberCounter = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
let pendingWriteErrors: string[] = [];

const PERSIST_PATH = getDocumentsFilePath("purchase-orders.json");

type PurchaseOrderPersistRecord = PurchaseOrder & {
  lines: PurchaseOrderLine[];
};

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asOptionalTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
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
    const n = extractGeneratedVisibleCodeCounter(r.number, "PO");
    if (n == null) continue;
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function computeNextAttachmentId(records: PurchaseOrderPersistRecord[]): number {
  let max = 0;
  for (const record of records) {
    for (const attachment of record.attachments ?? []) {
      const n = Number.parseInt(attachment.id, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

function normalizeAttachment(raw: unknown): PurchaseOrderAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.name !== "string" ||
    typeof rec.sizeBytes !== "number" ||
    !Number.isFinite(rec.sizeBytes) ||
    rec.sizeBytes < 0 ||
    typeof rec.contentBase64 !== "string" ||
    rec.contentBase64.trim() === "" ||
    typeof rec.addedAt !== "string"
  ) {
    return null;
  }
  const attachment: PurchaseOrderAttachment = {
    id: rec.id,
    name: rec.name.trim(),
    sizeBytes: Math.trunc(rec.sizeBytes),
    contentBase64: rec.contentBase64.trim(),
    addedAt: rec.addedAt,
  };
  if (typeof rec.mimeType === "string" && rec.mimeType.trim() !== "") {
    attachment.mimeType = rec.mimeType.trim();
  }
  return attachment.name === "" ? null : attachment;
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
  const attachmentsRaw = Array.isArray(rec.attachments) ? rec.attachments : [];
  const attachments = attachmentsRaw
    .map(normalizeAttachment)
    .filter((x): x is PurchaseOrderAttachment => x !== null);
  if (rec.lines.length > 0 && lines.length === 0) return null;
  return {
    id: rec.id,
    number: normalizeGeneratedVisibleCode(rec.number, "PO") ?? rec.number,
    date: rec.date,
    supplierId: rec.supplierId,
    warehouseId: rec.warehouseId,
    status: rec.status,
    preliminaryDeliveryDate: asOptionalTrimmedString(rec.preliminaryDeliveryDate),
    actualArrivalDateTime: asOptionalTrimmedString(rec.actualArrivalDateTime),
    paymentTermsDays: asOptionalPaymentTermsDays(rec.paymentTermsDays),
    dueDate: asOptionalString(rec.dueDate),
    comment: asOptionalString(rec.comment),
    ...(attachments.length > 0 ? { attachments } : {}),
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
      number: "PO000001",
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
        await writeDocumentPayload(PERSIST_PATH, snapshotPersistRecords());
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        pendingWriteErrors.push(lastWriteError);
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
  return formatGeneratedVisibleCode("PO", numberCounter++);
}

function nextAttachmentId(): string {
  return String(attachmentNextId++);
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
  attachmentNextId = computeNextAttachmentId(loaded.records);
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

  listAttachments(documentId: string): PurchaseOrderAttachment[] {
    const doc = headerStore.find((x) => x.id === documentId);
    return doc?.attachments?.map((attachment) => ({ ...attachment })) ?? [];
  },

  addAttachments(
    documentId: string,
    attachments: Array<Omit<PurchaseOrderAttachment, "id" | "addedAt">>,
  ): PurchaseOrderAttachment[] {
    const i = headerStore.findIndex((x) => x.id === documentId);
    if (i === -1 || attachments.length === 0) return [];
    const created = attachments
      .filter((attachment) => attachment.name.trim() !== "" && attachment.contentBase64.trim() !== "")
      .map((attachment) => ({
        ...attachment,
        id: nextAttachmentId(),
        addedAt: new Date().toISOString(),
      }));
    if (created.length === 0) return [];
    headerStore[i] = {
      ...headerStore[i],
      attachments: [...(headerStore[i].attachments ?? []), ...created],
    };
    schedulePersist();
    return created.map((attachment) => ({ ...attachment }));
  },

  deleteAttachment(documentId: string, attachmentId: string): boolean {
    const i = headerStore.findIndex((x) => x.id === documentId);
    if (i === -1) return false;
    const attachments = headerStore[i].attachments ?? [];
    const nextAttachments = attachments.filter((attachment) => attachment.id !== attachmentId);
    if (nextAttachments.length === attachments.length) return false;
    headerStore[i] = {
      ...headerStore[i],
      ...(nextAttachments.length > 0 ? { attachments: nextAttachments } : { attachments: undefined }),
    };
    schedulePersist();
    return true;
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
