import type { Workbook } from "exceljs";

export type CategoriesExportRow = {
  no: number;
  code: string;
  name: string;
  active: string;
};

const COLUMN_HEADERS = ["№", "Code", "Name", "Active"] as const;
const SHEET_NAME = "Categories";
const TABLE_NAME_BASE = "CategoriesTable";
const WIDTH_PADDING = 1.5;
const DEFAULT_MIN = 8;
const DEFAULT_MAX = 50;

function columnWidth(headerLen: number, valueLengths: number[], minW = DEFAULT_MIN, maxW = DEFAULT_MAX): number {
  const maxVal = valueLengths.length > 0 ? Math.max(...valueLengths) : 0;
  return Math.min(maxW, Math.max(minW, Math.ceil(Math.max(headerLen, maxVal) + WIDTH_PADDING)));
}

function cellLen(val: unknown): number {
  return val == null ? 0 : String(val).length;
}

function sanitizeTableName(name: string): string {
  if (!name?.length) return "Table1";
  let out = name.replace(/[^a-zA-Z0-9._]/g, "_");
  if (/^[0-9.]/.test(out)) out = `T${out}`;
  return out.length > 200 ? out.slice(0, 200) : out || "Table1";
}

const WIDTH_BOUNDS = [
  { min: 4, max: 6 },
  { min: 8, max: 24 },
  { min: 10, max: 42 },
  { min: 6, max: 10 },
];

function addSheet(workbook: Workbook, rows: CategoriesExportRow[]): void {
  const sheet = workbook.addWorksheet(SHEET_NAME, { views: [{ state: "frozen" as const, ySplit: 1 }] });
  if (rows.length === 0) {
    sheet.addRow([...COLUMN_HEADERS]);
    for (let c = 0; c < COLUMN_HEADERS.length; c++)
      sheet.getColumn(c + 1).width = columnWidth(COLUMN_HEADERS[c].length, [], WIDTH_BOUNDS[c]?.min ?? DEFAULT_MIN, WIDTH_BOUNDS[c]?.max ?? DEFAULT_MAX);
    return;
  }
  const columns = COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
  const tableRows = rows.map((r) => [r.no, r.code, r.name, r.active]);
  sheet.addTable({
    name: sanitizeTableName(TABLE_NAME_BASE),
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    columns,
    rows: tableRows,
  });
  for (let c = 0; c < COLUMN_HEADERS.length; c++) {
    const valueLengths = rows.map((r) => cellLen([r.no, r.code, r.name, r.active][c]));
    const b = WIDTH_BOUNDS[c] ?? { min: DEFAULT_MIN, max: DEFAULT_MAX };
    sheet.getColumn(c + 1).width = columnWidth(COLUMN_HEADERS[c].length, valueLengths, b.min, b.max);
  }
}

export async function buildCategoriesListXlsxBuffer(rows: CategoriesExportRow[]): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  addSheet(wb, rows);
  return wb.xlsx.writeBuffer();
}
