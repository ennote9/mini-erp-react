import type { Workbook } from "exceljs";

export type ItemsExportRow = {
  no: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  uom: string;
  purchasePrice: number | "";
  salePrice: number | "";
  active: string;
};

// Matches approved Items list grid columns (no checkbox, no action columns)
const ITEMS_COLUMN_HEADERS = [
  "№",
  "Code",
  "Name",
  "Brand",
  "Category",
  "UOM",
  "Purchase price",
  "Sale price",
  "Active",
] as const;

const ITEMS_SHEET_NAME = "Items";
const ITEMS_TABLE_NAME_BASE = "ItemsTable";

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

const ITEMS_WIDTH_BOUNDS: { min: number; max: number }[] = [
  { min: 4, max: 6 },
  { min: 8, max: 24 },
  { min: 10, max: 42 },
  { min: 8, max: 20 },
  { min: 8, max: 20 },
  { min: 4, max: 12 },
  { min: 12, max: 14 },
  { min: 10, max: 14 },
  { min: 6, max: 10 },
];

function applyItemsSheetColumnWidths(
  sheet: { getColumn: (col: number) => { width?: number } },
  rows: ItemsExportRow[],
): void {
  const headers = [...ITEMS_COLUMN_HEADERS];
  for (let c = 0; c < headers.length; c++) {
    const headerLen = headers[c].length;
    const valueLengths = rows.map((r) => {
      const row = [r.no, r.code, r.name, r.brand, r.category, r.uom, r.purchasePrice, r.salePrice, r.active];
      return cellDisplayLength(row[c]);
    });
    const bounds = ITEMS_WIDTH_BOUNDS[c] ?? { min: DEFAULT_MIN_WIDTH, max: DEFAULT_MAX_WIDTH };
    const w = columnWidthFromLengths(headerLen, valueLengths, bounds.min, bounds.max);
    sheet.getColumn(c + 1).width = w;
  }
}

function addItemsSheetWithTable(workbook: Workbook, rows: ItemsExportRow[]): void {
  const sheet = workbook.addWorksheet(ITEMS_SHEET_NAME, {
    views: [{ state: "frozen" as const, ySplit: 1 }],
  });

  if (rows.length === 0) {
    sheet.addRow([...ITEMS_COLUMN_HEADERS]);
    applyItemsSheetColumnWidths(sheet, []);
    return;
  }

  const columns = ITEMS_COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
  const tableRows = rows.map((r) => [
    r.no,
    r.code,
    r.name,
    r.brand,
    r.category,
    r.uom,
    r.purchasePrice,
    r.salePrice,
    r.active,
  ]);

  const tableName = sanitizeTableName(ITEMS_TABLE_NAME_BASE);
  sheet.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    columns,
    rows: tableRows,
  });
  applyItemsSheetColumnWidths(sheet, rows);
}

export async function buildItemsListXlsxBuffer(rows: ItemsExportRow[]): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addItemsSheetWithTable(workbook, rows);
  return workbook.xlsx.writeBuffer();
}
