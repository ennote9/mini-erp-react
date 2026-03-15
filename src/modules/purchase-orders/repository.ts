import type { PurchaseOrder, PurchaseOrderLine } from "./model";
import { todayYYYYMMDD } from "./dateUtils";

export type CreatePurchaseOrderHeaderInput = Omit<
  PurchaseOrder,
  "id" | "number"
>;
export type PurchaseOrderLineInput = { itemId: string; qty: number };
export type UpdatePurchaseOrderPatch = Partial<
  Omit<PurchaseOrder, "id" | "number">
>;

const headerStore: PurchaseOrder[] = [];
const lineStore: PurchaseOrderLine[] = [];
let headerNextId = 1;
let lineNextId = 1;
let numberCounter = 1;

function nextHeaderId(): string {
  return String(headerNextId++);
}
function nextLineId(): string {
  return String(lineNextId++);
}
function nextNumber(): string {
  return `PO-${String(numberCounter++).padStart(6, "0")}`;
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
      lineStore.push({
        id: nextLineId(),
        purchaseOrderId: id,
        itemId: l.itemId,
        qty: l.qty,
      });
    }
    return doc;
  },

  update(id: string, patch: UpdatePurchaseOrderPatch): PurchaseOrder | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
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
      const line: PurchaseOrderLine = {
        id: nextLineId(),
        purchaseOrderId: documentId,
        itemId: l.itemId,
        qty: l.qty,
      };
      lineStore.push(line);
      newLines.push(line);
    }
    return newLines;
  },
};

// Minimal seed: one draft PO (date in YYYY-MM-DD, local today)
const wh = "1";
const sup = "1";
purchaseOrderRepository.create(
  {
    date: todayYYYYMMDD(),
    supplierId: sup,
    warehouseId: wh,
    status: "draft",
  },
  [{ itemId: "1", qty: 10 }],
);
