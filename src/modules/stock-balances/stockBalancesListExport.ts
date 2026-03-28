import type { Workbook } from "exceljs";
import type { ExcelListSheetLabels } from "../../shared/export/excelExportLabels";

export type StockBalancesExportRow = {
  no: number;
  itemCode: string;
  itemName: string;
  warehouse: string;
  style: string;
  totalQty: number;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
  deficitQty: number;
  netShortageQty: number;
  coverage: string;
};

const TABLE_NAME_BASE = "StockBalancesTable";
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
  { min: 10, max: 24 },
  { min: 10, max: 42 },
  { min: 10, max: 24 },
  { min: 10, max: 18 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 14 },
  { min: 10, max: 18 },
];

function addSheet(workbook: Workbook, rows: StockBalancesExportRow[], labels: ExcelListSheetLabels): void {
  const COLUMN_HEADERS = labels.headers;
  const sheet = workbook.addWorksheet(labels.sheetName, { views: [{ state: "frozen" as const, ySplit: 1 }] });
  if (rows.length === 0) {
    sheet.addRow([...COLUMN_HEADERS]);
    for (let c = 0; c < COLUMN_HEADERS.length; c++)
      sheet.getColumn(c + 1).width = columnWidth(COLUMN_HEADERS[c].length, [], WIDTH_BOUNDS[c]?.min ?? DEFAULT_MIN, WIDTH_BOUNDS[c]?.max ?? DEFAULT_MAX);
    return;
  }
  const columns = COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
  const tableRows = rows.map((r) => [
    r.no,
    r.itemCode,
    r.itemName,
    r.warehouse,
    r.style,
    r.totalQty,
    r.reservedQty,
    r.availableQty,
    r.deficitQty,
    r.outgoingQty,
    r.incomingQty,
    r.netShortageQty,
    r.coverage,
  ]);
  sheet.addTable({
    name: sanitizeTableName(TABLE_NAME_BASE),
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    columns,
    rows: tableRows,
  });
  for (let c = 0; c < COLUMN_HEADERS.length; c++) {
    const valueLengths = rows.map((r) =>
      cellLen(
        [
          r.no,
          r.itemCode,
          r.itemName,
          r.warehouse,
          r.style,
          r.totalQty,
          r.reservedQty,
          r.availableQty,
          r.deficitQty,
          r.outgoingQty,
          r.incomingQty,
          r.netShortageQty,
          r.coverage,
        ][c],
      ),
    );
    const b = WIDTH_BOUNDS[c] ?? { min: DEFAULT_MIN, max: DEFAULT_MAX };
    sheet.getColumn(c + 1).width = columnWidth(COLUMN_HEADERS[c].length, valueLengths, b.min, b.max);
  }
}

export async function buildStockBalancesListXlsxBuffer(
  rows: StockBalancesExportRow[],
  labels: ExcelListSheetLabels,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  addSheet(wb, rows, labels);
  return wb.xlsx.writeBuffer();
}
