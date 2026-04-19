import ExcelJS from "exceljs";
import { parseMarkingPoolFromGrid } from "./parseMarkingPoolImport";

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

export async function parseMarkingPoolXlsx(arrayBuffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return parseMarkingPoolFromGrid([], [], 2);
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
    return parseMarkingPoolFromGrid([], [], 2);
  }

  const padded = data.map((r) => {
    const x = [...r];
    while (x.length < maxCol) x.push("");
    return x;
  });

  const headerRow = padded[0] ?? [];
  const dataRows = padded.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return parseMarkingPoolFromGrid(headerRow, dataRows, 2);
}

export async function buildMarkingPoolTemplateXlsxBuffer(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Marking import", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [
    "code",
    "barcode",
    "markingKind",
    "payload",
    "humanLabel",
    "serial",
    "batchRef",
    "source",
    "note",
  ];
  ws.addRow(headers);
  ws.addRow(["ITEM-001", "", "KIZ", "KIZ-EXAMPLE-001", "Lot A", "SN001", "BATCH-1", "IMPORT", ""]);
  const buf = await wb.xlsx.writeBuffer();
  if (buf instanceof ArrayBuffer) return buf;
  const u8 = new Uint8Array(buf as Buffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}
