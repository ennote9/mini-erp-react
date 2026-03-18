import type { Workbook } from "exceljs";

export type ReceiptExportLineRow = {
  no: number;
  itemCode: string;
  itemName: string;
  brand: string;
  category: string;
  qty: number;
  uom: string;
};

export type ReceiptDocumentSummary = {
  number: string;
  date: string;
  purchaseOrder: string;
  warehouse: string;
  comment: string;
};

// Lines sheet columns — matches approved Receipt grid (no Unit price / Line amount)
const LINES_COLUMN_HEADERS = [
  "№",
  "Item Code",
  "Item Name",
  "Brand",
  "Category",
  "Qty",
  "UOM",
] as const;

const LINES_SHEET_NAME = "Lines";
const DOC_SHEET_NAME = "Document";
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
  lineRows: ReceiptExportLineRow[],
): void {
  const headers = [...LINES_COLUMN_HEADERS];
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

function addLinesSheetWithTable(workbook: Workbook, lineRows: ReceiptExportLineRow[], sheetName: string): void {
  const sheet = workbook.addWorksheet(sheetName);

  if (lineRows.length === 0) {
    sheet.addRow([...LINES_COLUMN_HEADERS]);
    applyLinesSheetColumnWidths(sheet, []);
    return;
  }

  const columns = LINES_COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
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
  applyLinesSheetColumnWidths(sheet, lineRows);
}

export async function buildLinesXlsxBuffer(rows: ReceiptExportLineRow[]): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addLinesSheetWithTable(workbook, rows, LINES_SHEET_NAME);
  return workbook.xlsx.writeBuffer();
}

const DOC_LABELS = ["Number", "Date", "Related Purchase Order", "Warehouse", "Comment"] as const;
const DOC_SUMMARY_ROWS = 5;

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
  summary: ReceiptDocumentSummary,
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
  summary: ReceiptDocumentSummary,
): void {
  const labelLengths = DOC_LABELS.map((s) => s.length);
  const valueLengths = [
    cellDisplayLength(summary.number),
    cellDisplayLength(summary.date),
    cellDisplayLength(summary.purchaseOrder),
    cellDisplayLength(summary.warehouse),
    cellDisplayLength(summary.comment),
  ];
  const labelW = columnWidthFromLengths(Math.max(...labelLengths), labelLengths, 10, 22);
  const valueW = columnWidthFromLengths(0, valueLengths, 10, 40);
  sheet.getColumn(1).width = labelW;
  sheet.getColumn(2).width = valueW;
}

export async function buildDocumentXlsxBuffer(
  summary: ReceiptDocumentSummary,
  lineRows: ReceiptExportLineRow[],
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const docSheet = workbook.addWorksheet(DOC_SHEET_NAME);
  docSheet.addRow(["Number", summary.number]);
  docSheet.addRow(["Date", summary.date]);
  docSheet.addRow(["Related Purchase Order", summary.purchaseOrder]);
  docSheet.addRow(["Warehouse", summary.warehouse]);
  docSheet.addRow(["Comment", summary.comment]);
  applyDocumentSheetColumnWidths(docSheet, summary);
  formatDocumentSummaryBlock(docSheet, summary);
  addLinesSheetWithTable(workbook, lineRows, LINES_SHEET_NAME);
  return workbook.xlsx.writeBuffer();
}
