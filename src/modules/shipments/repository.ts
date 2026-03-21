import type { Shipment, ShipmentLine } from "./model";
import type { FactualDocumentStatus } from "../../shared/domain";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "../../shared/documentPersistence";
import { registerPersistenceFlush } from "../../shared/persistenceCoordinator";
import { isCancelDocumentReasonCode } from "../../shared/reasonCodes";

export type CreateShipmentHeaderInput = Omit<Shipment, "id" | "number">;
export type ShipmentLineInput = { itemId: string; qty: number };
export type UpdateShipmentPatch = Partial<Omit<Shipment, "id" | "number">>;

const headerStore: Shipment[] = [];
const lineStore: ShipmentLine[] = [];
let headerNextId = 1;
let lineNextId = 1;
let numberCounter = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getDocumentsFilePath("shipments.json");

type ShipmentPersistRecord = Shipment & {
  lines: ShipmentLine[];
};

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isFactualStatus(v: unknown): v is FactualDocumentStatus {
  return v === "draft" || v === "posted" || v === "cancelled";
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function computeNextShipmentNumberCounter(records: Shipment[]): number {
  let max = 0;
  for (const r of records) {
    const m = /^SHP-(\d+)$/.exec(r.number);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function normalizeLine(raw: unknown): ShipmentLine | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.shipmentId !== "string" ||
    typeof rec.itemId !== "string" ||
    typeof rec.qty !== "number" ||
    !Number.isFinite(rec.qty)
  ) {
    return null;
  }
  return {
    id: rec.id,
    shipmentId: rec.shipmentId,
    itemId: rec.itemId,
    qty: rec.qty,
  };
}

function normalizeShipmentRecord(raw: unknown): ShipmentPersistRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.number !== "string" ||
    typeof rec.date !== "string" ||
    typeof rec.salesOrderId !== "string" ||
    typeof rec.warehouseId !== "string" ||
    !isFactualStatus(rec.status) ||
    !Array.isArray(rec.lines)
  ) {
    return null;
  }
  const lines = rec.lines.map(normalizeLine).filter((x): x is ShipmentLine => x !== null);
  if (rec.lines.length > 0 && lines.length === 0) return null;
  return {
    id: rec.id,
    number: rec.number,
    date: rec.date,
    salesOrderId: rec.salesOrderId,
    warehouseId: rec.warehouseId,
    status: rec.status,
    comment: asOptionalString(rec.comment),
    cancelReasonCode:
      typeof rec.cancelReasonCode === "string" && isCancelDocumentReasonCode(rec.cancelReasonCode)
        ? rec.cancelReasonCode
        : undefined,
    cancelReasonComment: asOptionalString(rec.cancelReasonComment),
    lines,
  };
}

function buildSeedRecords(): ShipmentPersistRecord[] {
  return [];
}

function snapshotPersistRecords(): ShipmentPersistRecord[] {
  return headerStore.map((header) => ({
    ...header,
    lines: lineStore.filter((l) => l.shipmentId === header.id).map((l) => ({ ...l })),
  }));
}

export function getShipmentPersistBusy(): boolean {
  return persistDepth > 0;
}

export function getLastShipmentPersistError(): string | null {
  return lastWriteError;
}

export async function flushPendingShipmentPersist(): Promise<void> {
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
          console.error("[shipmentRepository] persist failed:", e);
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
  return `SHP-${String(numberCounter++).padStart(6, "0")}`;
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizeShipmentRecord,
    diagnosticsTag: "shipmentRepository",
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
  numberCounter = computeNextShipmentNumberCounter(headerStore);
}

export const shipmentRepository = {
  list(): Shipment[] {
    return [...headerStore];
  },

  getById(id: string): Shipment | undefined {
    return headerStore.find((x) => x.id === id);
  },

  listLines(documentId: string): ShipmentLine[] {
    return lineStore.filter((x) => x.shipmentId === documentId);
  },

  create(
    header: CreateShipmentHeaderInput,
    lines: ShipmentLineInput[],
  ): Shipment {
    const id = nextHeaderId();
    const number = nextNumber();
    const doc: Shipment = {
      ...header,
      id,
      number,
      status: header.status ?? "draft",
    };
    headerStore.push(doc);
    for (const l of lines) {
      lineStore.push({
        id: nextLineId(),
        shipmentId: id,
        itemId: l.itemId,
        qty: l.qty,
      });
    }
    schedulePersist();
    return doc;
  },

  update(id: string, patch: UpdateShipmentPatch): Shipment | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
    schedulePersist();
    return headerStore[i];
  },

  replaceLines(
    documentId: string,
    lines: ShipmentLineInput[],
  ): ShipmentLine[] {
    const existing = lineStore.filter((x) => x.shipmentId !== documentId);
    lineStore.length = 0;
    lineStore.push(...existing);
    const newLines: ShipmentLine[] = [];
    for (const l of lines) {
      const line: ShipmentLine = {
        id: nextLineId(),
        shipmentId: documentId,
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
  id: "shipments",
  flush: flushPendingShipmentPersist,
  isBusy: getShipmentPersistBusy,
});
