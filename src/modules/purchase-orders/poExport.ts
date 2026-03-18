import type { Workbook } from "exceljs";

export type PoExportLineRow = {
  no: number;
  itemCode: string;
  itemName: string;
  brand: string;
  category: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
};

export type PoDocumentSummary = {
  number: string;
  date: string;
  status: string;
  supplier: string;
  warehouse: string;
  comment: string;
  totalQty: number;
  totalAmount: number;
};

// Single source of truth for Lines sheet columns (order and headers)
const LINES_COLUMN_HEADERS = [
  "№",
  "Item Code",
  "Item Name",
  "Brand",
  "Category",
  "Qty",
  "Unit Price",
  "Line Amount",
] as const;

const LINES_SHEET_NAME = "Lines";
const DOC_SHEET_NAME = "Document";
const LINES_TABLE_NAME_BASE = "LinesTable";

/**
 * Sanitize table name for Excel: must start with letter, underscore, or backslash;
 * only letters, numbers, periods, underscores allowed. Prevents corrupt workbook.
 */
function sanitizeTableName(name: string): string {
  if (!name || name.length === 0) return "Table1";
  // Replace invalid chars with underscore; allow only [a-zA-Z0-9._]
  let out = name.replace(/[^a-zA-Z0-9._]/g, "_");
  // Excel: must not start with number or period
  if (/^[0-9.]/.test(out)) out = `T${out}`;
  if (out.length === 0) return "Table1";
  // Cap length (Excel allows 255; keep reasonable)
  if (out.length > 200) out = out.slice(0, 200);
  return out;
}

/**
 * Add Lines sheet. If lineRows.length >= 1, creates a real Excel Table.
 * If lineRows.length === 0, adds sheet with header row only (no table) to avoid corrupt file.
 */
function addLinesSheetWithTable(workbook: Workbook, lineRows: PoExportLineRow[], sheetName: string): void {
  const sheet = workbook.addWorksheet(sheetName);

  if (lineRows.length === 0) {
    // No table when no data: header row only, no addTable (empty table can corrupt)
    sheet.addRow([...LINES_COLUMN_HEADERS]);
    return;
  }

  const columns = LINES_COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
  const rows = lineRows.map((r) => [
    r.no,
    r.itemCode,
    r.itemName,
    r.brand,
    r.category,
    r.qty,
    r.unitPrice,
    r.lineAmount,
  ]);

  const tableName = sanitizeTableName(LINES_TABLE_NAME_BASE);
  sheet.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    columns,
    rows,
  });
}

export async function buildLinesXlsxBuffer(rows: PoExportLineRow[]): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addLinesSheetWithTable(workbook, rows, LINES_SHEET_NAME);
  return workbook.xlsx.writeBuffer();
}

export async function buildDocumentXlsxBuffer(
  summary: PoDocumentSummary,
  lineRows: PoExportLineRow[],
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const docSheet = workbook.addWorksheet(DOC_SHEET_NAME);
  docSheet.addRow(["Number", summary.number]);
  docSheet.addRow(["Date", summary.date]);
  docSheet.addRow(["Status", summary.status]);
  docSheet.addRow(["Supplier", summary.supplier]);
  docSheet.addRow(["Warehouse", summary.warehouse]);
  docSheet.addRow(["Comment", summary.comment]);
  docSheet.addRow(["Total Qty", summary.totalQty]);
  docSheet.addRow(["Total Amount", summary.totalAmount]);
  addLinesSheetWithTable(workbook, lineRows, LINES_SHEET_NAME);
  return workbook.xlsx.writeBuffer();
}
