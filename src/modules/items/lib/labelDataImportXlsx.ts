import ExcelJS from "exceljs";
import type { ItemLabelDataDraft } from "./itemLabelDataBulk";
import { itemToLabelDataDraft, LABEL_DATA_FIELD_KEYS, primaryBarcodeValue } from "./itemLabelDataBulk";
import type { Item } from "../model";
import { exportTemplateTsvHeader, parseLabelDataFromGrid } from "./parseLabelDataImport";

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "text" in value && typeof (value as { text?: string }).text === "string") {
    return String((value as { text: string }).text).trim();
  }
  if (typeof value === "object" && value !== null && "richText" in value) {
    const rt = (value as { richText?: { text: string }[] }).richText;
    if (Array.isArray(rt)) return rt.map((x) => x.text).join("").trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function toArrayBuffer(buf: ExcelJS.Buffer): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  const u8 = new Uint8Array(buf as Buffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

/**
 * Read first worksheet: row 1 = headers, following rows = data. Empty rows skipped.
 * Produces the same {@link import("./parseLabelDataImport").ParseLabelDataImportResult} as TSV/CSV text import.
 */
export async function parseLabelDataXlsx(arrayBuffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return parseLabelDataFromGrid([], [], 2);
  }

  const data: string[][] = [];
  let maxCol = 0;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values;
    if (!vals || !Array.isArray(vals)) return;
    const slice = vals.slice(1).map((v) => cellToString(v as ExcelJS.CellValue));
    maxCol = Math.max(maxCol, slice.length);
    data.push(slice);
  });

  if (data.length === 0) {
    return parseLabelDataFromGrid([], [], 2);
  }

  const padded = data.map((r) => {
    const x = [...r];
    while (x.length < maxCol) x.push("");
    return x;
  });

  const headerRow = padded[0] ?? [];
  const dataRows = padded.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return parseLabelDataFromGrid(headerRow, dataRows, 2);
}

function headerCellsFromTemplate(): string[] {
  return exportTemplateTsvHeader().split("\t");
}

export async function buildLabelDataTemplateXlsxBuffer(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Label data", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = headerCellsFromTemplate();
  ws.addRow(headers);
  ws.addRow([
    "ITEM-001",
    "Example product name",
    "4600000000000",
    "Example EN name",
    "Short description",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(24, Math.max(12, h.length + 2));
  });
  const buf = await wb.xlsx.writeBuffer();
  return toArrayBuffer(buf);
}

export async function buildLabelDataExportXlsxBuffer(
  items: readonly Item[],
  draftById: Record<string, ItemLabelDataDraft>,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Label data", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = headerCellsFromTemplate();
  ws.addRow(headers);
  for (const it of items) {
    const d = draftById[it.id] ?? itemToLabelDataDraft(it);
    ws.addRow([
      it.code,
      it.name,
      primaryBarcodeValue(it),
      ...LABEL_DATA_FIELD_KEYS.map((k) => d[k] ?? ""),
    ]);
  }
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(28, Math.max(10, h.length + 2));
  });
  const buf = await wb.xlsx.writeBuffer();
  return toArrayBuffer(buf);
}
