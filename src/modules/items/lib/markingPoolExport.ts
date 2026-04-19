import ExcelJS from "exceljs";
import type { ItemMarkingRecord } from "../model/itemMarkingRecord";
import { itemRepository } from "../repository";
import { markingRecordRepository } from "../markingRecordRepository";

/** Tab-separated template header row for marking import. */
export function buildMarkingPoolTemplateTsv(): string {
  return ["code", "barcode", "markingKind", "payload", "humanLabel", "serial", "batchRef", "source", "note"].join("\t");
}

export function buildMarkingPoolExportTsv(): string {
  const header = [
    "itemCode",
    "itemName",
    "payload",
    "kind",
    "status",
    "source",
    "batchRef",
    "serial",
    "note",
    "humanLabel",
    "id",
  ];
  const lines: string[] = [header.join("\t")];
  const items = itemRepository.list();
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const r of markingRecordRepository.list()) {
    const it = byId.get(r.itemId);
    lines.push(
      [
        it?.code ?? "",
        it?.name ?? "",
        r.payload.replace(/\t/g, " "),
        r.kind,
        r.status,
        r.source ?? "",
        r.batchRef ?? "",
        r.serial ?? "",
        (r.note ?? "").replace(/\t/g, " "),
        r.humanLabel ?? "",
        r.id,
      ].join("\t"),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildMarkingPoolExportCsv(): string {
  const header = [
    "itemCode",
    "itemName",
    "payload",
    "kind",
    "status",
    "source",
    "batchRef",
    "serial",
    "note",
    "humanLabel",
    "id",
  ];
  const lines: string[] = [header.map(escapeCsv).join(",")];
  const items = itemRepository.list();
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const r of markingRecordRepository.list()) {
    const it = byId.get(r.itemId);
    lines.push(
      [
        it?.code ?? "",
        it?.name ?? "",
        r.payload,
        r.kind,
        r.status,
        r.source ?? "",
        r.batchRef ?? "",
        r.serial ?? "",
        r.note ?? "",
        r.humanLabel ?? "",
        r.id,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export async function buildMarkingPoolExportXlsxBuffer(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Marking pool", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [
    "itemCode",
    "itemName",
    "payload",
    "kind",
    "status",
    "source",
    "batchRef",
    "serial",
    "note",
    "humanLabel",
    "id",
  ];
  ws.addRow(headers);
  const items = itemRepository.list();
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const r of markingRecordRepository.list()) {
    const it = byId.get(r.itemId);
    ws.addRow([
      it?.code ?? "",
      it?.name ?? "",
      r.payload,
      r.kind,
      r.status,
      r.source ?? "",
      r.batchRef ?? "",
      r.serial ?? "",
      r.note ?? "",
      r.humanLabel ?? "",
      r.id,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  if (buf instanceof ArrayBuffer) return buf;
  const u8 = new Uint8Array(buf as Buffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export type MarkingPoolExportRow = {
  itemCode: string;
  itemName: string;
  record: ItemMarkingRecord;
};

export function getMarkingPoolExportRows(): MarkingPoolExportRow[] {
  const items = itemRepository.list();
  const byId = new Map(items.map((i) => [i.id, i]));
  return markingRecordRepository.list().map((r) => ({
    itemCode: byId.get(r.itemId)?.code ?? "",
    itemName: byId.get(r.itemId)?.name ?? "",
    record: r,
  }));
}
