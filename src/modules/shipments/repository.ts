import type { Shipment, ShipmentLine } from "./model";

export type CreateShipmentHeaderInput = Omit<Shipment, "id" | "number">;
export type ShipmentLineInput = { itemId: string; qty: number };
export type UpdateShipmentPatch = Partial<Omit<Shipment, "id" | "number">>;

const headerStore: Shipment[] = [];
const lineStore: ShipmentLine[] = [];
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
  return `SHP-${String(numberCounter++).padStart(6, "0")}`;
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
    return doc;
  },

  update(id: string, patch: UpdateShipmentPatch): Shipment | undefined {
    const i = headerStore.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    headerStore[i] = { ...headerStore[i], ...patch };
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
    return newLines;
  },
};
