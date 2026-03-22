import type { Workbook } from "exceljs";
import type { ShipmentExcelLabels } from "../../shared/export/excelExportLabels";

export type ShipmentExportLineRow = {
  no: number;
  itemCode: string;
  itemName: string;
  brand: string;
  category: string;
  qty: number;
  uom: string;
};

export type ShipmentDocumentSummary = {
  number: string;
  date: string;
  salesOrder: string;
  warehouse: string;
  carrier: string;
  trackingNumber: string;
  comment: string;
};

const LINES_TABLE_NAME_BASE = "LinesTable";

const WIDTH_PADDING = 1.5;
const DEFAULT_MIN_WIDTH = 8;
const DEFAULT_MAX_WIDTH = 50;

function columnWidthFromLengths(
  headerLength: number,
  valueLengths: number[],
  minW: number = DEFAULT_MIN_WIDTH,
  maxW: number = DEFAULT_MAX_WIDTH,
): number {
  const maxVal = valueLengths.length > 0 ? Math.max(...valueLengths) : 0;
  const w = Math.max(headerLength, maxVal) + WIDTH_PADDING;
  return Math.min(maxW, Math.max(minW, Math.ceil(w)));
}

function cellDisplayLength(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return String(val).length;
}

function sanitizeTableName(name: string): string {
  if (!name || name.length === 0) return "Table1";
  let out = name.replace(/[^a-zA-Z0-9._]/g, "_");
  if (/^[0-9.]/.test(out)) out = `T${out}`;
  if (out.length === 0) return "Table1";
  if (out.length > 200) out = out.slice(0, 200);
  return out;
}

const LINES_WIDTH_BOUNDS: { min: number; max: number }[] = [
  { min: 4, max: 6 },
  { min: 10, max: 20 },
  { min: 12, max: 42 },
  { min: 8, max: 18 },
  { min: 8, max: 18 },
  { min: 5, max: 10 },
  { min: 5, max: 12 },
];

function applyLinesSheetColumnWidths(
  sheet: { getColumn: (col: number) => { width?: number } },
  lineRows: ShipmentExportLineRow[],
  lineHeaders: readonly string[],
): void {
  const headers = [...lineHeaders];
  for (let c = 0; c < headers.length; c++) {
    const headerLen = headers[c].length;
    const valueLengths = lineRows.map((r) => {
      const row = [r.no, r.itemCode, r.itemName, r.brand, r.category, r.qty, r.uom];
      return cellDisplayLength(row[c]);
    });
    const bounds = LINES_WIDTH_BOUNDS[c] ?? { min: DEFAULT_MIN_WIDTH, max: DEFAULT_MAX_WIDTH };
    const w = columnWidthFromLengths(headerLen, valueLengths, bounds.min, bounds.max);
    sheet.getColumn(c + 1).width = w;
  }
}

function addLinesSheetWithTable(
  workbook: Workbook,
  lineRows: ShipmentExportLineRow[],
  sheetName: string,
  lineHeaders: readonly string[],
): void {
  const sheet = workbook.addWorksheet(sheetName);
  const headers = [...lineHeaders];

  if (lineRows.length === 0) {
    sheet.addRow(headers);
    applyLinesSheetColumnWidths(sheet, [], lineHeaders);
    return;
  }

  const columns = headers.map((name) => ({ name, filterButton: true }));
  const rows = lineRows.map((r) => [r.no, r.itemCode, r.itemName, r.brand, r.category, r.qty, r.uom]);

  const tableName = sanitizeTableName(LINES_TABLE_NAME_BASE);
  sheet.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    columns,
    rows,
  });
  applyLinesSheetColumnWidths(sheet, lineRows, lineHeaders);
}

export async function buildLinesXlsxBuffer(
  rows: ShipmentExportLineRow[],
  labels: ShipmentExcelLabels,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addLinesSheetWithTable(workbook, rows, labels.linesSheetName, labels.shipmentLineHeaders);
  return workbook.xlsx.writeBuffer();
}

const DOC_SUMMARY_ROWS = 7;

const THIN_BORDER = { style: "thin" as const };
const BLOCK_BORDER = {
  top: THIN_BORDER,
  left: THIN_BORDER,
  bottom: THIN_BORDER,
  right: THIN_BORDER,
};

function formatDocumentSummaryBlock(
  sheet: {
    getRow: (row: number) => { getCell: (col: number) => { font?: unknown; border?: unknown; alignment?: unknown; fill?: unknown; numFmt?: string; value?: unknown } };
  },
  summary: ShipmentDocumentSummary,
): void {
  for (let r = 1; r <= DOC_SUMMARY_ROWS; r++) {
    const row = sheet.getRow(r);
    const cellA = row.getCell(1);
    const cellB = row.getCell(2);
    cellA.font = { bold: true };
    cellA.border = BLOCK_BORDER;
    cellA.alignment = { vertical: "middle" };
    cellB.border = BLOCK_BORDER;
    cellB.alignment = { vertical: "middle" };
  }
  const lightFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };
  for (let r = 1; r <= DOC_SUMMARY_ROWS; r++) {
    sheet.getRow(r).getCell(1).fill = lightFill;
  }
  const dateCell = sheet.getRow(2).getCell(2);
  const dateParsed = Date.parse(summary.date);
  if (!Number.isNaN(dateParsed)) {
    (dateCell as { value?: unknown }).value = new Date(dateParsed);
  }
  dateCell.numFmt = "yyyy-mm-dd";
}

function applyDocumentSheetColumnWidths(
  sheet: { getColumn: (col: number) => { width?: number } },
  summary: ShipmentDocumentSummary,
  docLabels: readonly string[],
): void {
  const labelLengths = docLabels.map((s) => s.length);
  const valueLengths = [
    cellDisplayLength(summary.number),
    cellDisplayLength(summary.date),
    cellDisplayLength(summary.salesOrder),
    cellDisplayLength(summary.warehouse),
    cellDisplayLength(summary.comment),
  ];
  const labelW = columnWidthFromLengths(Math.max(...labelLengths), labelLengths, 10, 22);
  const valueW = columnWidthFromLengths(0, valueLengths, 10, 40);
  sheet.getColumn(1).width = labelW;
  sheet.getColumn(2).width = valueW;
}

export async function buildDocumentXlsxBuffer(
  summary: ShipmentDocumentSummary,
  lineRows: ShipmentExportLineRow[],
  labels: ShipmentExcelLabels,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const docSheet = workbook.addWorksheet(labels.documentSheetName);
  const L = labels.shipmentDocumentLabels;
  docSheet.addRow([L[0], summary.number]);
  docSheet.addRow([L[1], summary.date]);
  docSheet.addRow([L[2], summary.salesOrder]);
  docSheet.addRow([L[3], summary.warehouse]);
  docSheet.addRow([L[4], summary.carrier]);
  docSheet.addRow([L[5], summary.trackingNumber]);
  docSheet.addRow([L[6], summary.comment]);
  applyDocumentSheetColumnWidths(docSheet, summary, L);
  formatDocumentSummaryBlock(docSheet, summary);
  addLinesSheetWithTable(workbook, lineRows, labels.linesSheetName, labels.shipmentLineHeaders);
  return workbook.xlsx.writeBuffer();
}
