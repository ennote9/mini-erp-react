import type { SalesOrder, SalesOrderLine } from "./model";
import { todayYYYYMMDD } from "./dateUtils";

export type CreateSalesOrderHeaderInput = Omit<
  SalesOrder,
  "id" | "number"
>;
export type SalesOrderLineInput = { itemId: string; qty: number };
export type UpdateSalesOrderPatch = Partial<
  Omit<SalesOrder, "id" | "number">
>;

const headerStore: SalesOrder[] = [];
const lineStore: SalesOrderLine[] = [];
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
  return `SO-${String(numberCounter++).padStart(6, "0")}`;
}

export const salesOrderRepository = {
  list(): SalesOrder[] {
    return [...headerStore];
  },

  getById(id: string): SalesOrder | undefined {
    return headerStore.find((x) => x.id === id);
  },

  listLines(documentId: string): SalesOrderLine[] {
    return lineStore.filter((x) => x.salesOrderId === documentId);
  },

  create(
    header: CreateSalesOrderHeaderInput,
    lines: SalesOrderLineInput[],
  ): SalesOrder {
    const id = nextHeaderId();
    const number = nextNumber();
    const doc: SalesOrder = {
      ...header,
      id,
      number,
      status: header.status ?? "draft",
    };
    headerStore.push(doc);
    for (const l of lines) {
      lineStore.push({
        id: nextLineId(),
        salesOrderId: id,
        itemId: l.itemId,
        qty: l.qty,
      });
    }
    return doc;
  },

  update(id: string, patch: UpdateSalesOrderPatch): SalesOrder | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
    return headerStore[i];
  },

  replaceLines(
    documentId: string,
    lines: SalesOrderLineInput[],
  ): SalesOrderLine[] {
    const existing = lineStore.filter((x) => x.salesOrderId !== documentId);
    lineStore.length = 0;
    lineStore.push(...existing);
    const newLines: SalesOrderLine[] = [];
    for (const l of lines) {
      const line: SalesOrderLine = {
        id: nextLineId(),
        salesOrderId: documentId,
        itemId: l.itemId,
        qty: l.qty,
      };
      lineStore.push(line);
      newLines.push(line);
    }
    return newLines;
  },
};

// Minimal seed: one draft SO (date in YYYY-MM-DD, local today)
salesOrderRepository.create(
  {
    date: todayYYYYMMDD(),
    customerId: "1",
    warehouseId: "1",
    status: "draft",
  },
  [{ itemId: "1", qty: 5 }],
);
