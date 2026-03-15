import type { Receipt, ReceiptLine } from "./model";

export type CreateReceiptHeaderInput = Omit<Receipt, "id" | "number">;
export type ReceiptLineInput = { itemId: string; qty: number };
export type UpdateReceiptPatch = Partial<Omit<Receipt, "id" | "number">>;

const headerStore: Receipt[] = [];
const lineStore: ReceiptLine[] = [];
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
  return `RCPT-${String(numberCounter++).padStart(6, "0")}`;
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
    return doc;
  },

  update(id: string, patch: UpdateReceiptPatch): Receipt | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
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
    return newLines;
  },
};
