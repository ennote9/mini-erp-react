import type { Workbook } from "exceljs";
import type { ExcelListSheetLabels } from "@/shared/export/excelExportLabels";

export type BarcodeRegistryExportRow = {
  no: number;
  code: string;
  entryType: string;
  itemCode: string;
  itemName: string;
  active: string;
  source: string;
  created: string;
  symbology: string;
  markdownJournal: string;
  status: string;
};

const TABLE_NAME_BASE = "BarcodeRegistryTable";
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
  { min: 12, max: 24 },
  { min: 12, max: 18 },
  { min: 10, max: 18 },
  { min: 12, max: 40 },
  { min: 8, max: 12 },
  { min: 10, max: 18 },
  { min: 10, max: 22 },
  { min: 10, max: 18 },
  { min: 12, max: 18 },
  { min: 10, max: 16 },
];

function addSheet(workbook: Workbook, rows: BarcodeRegistryExportRow[], labels: ExcelListSheetLabels): void {
  const COLUMN_HEADERS = labels.headers;
  const sheet = workbook.addWorksheet(labels.sheetName, {
    views: [{ state: "frozen" as const, ySplit: 1 }],
  });
  if (rows.length === 0) {
    sheet.addRow([...COLUMN_HEADERS]);
    for (let c = 0; c < COLUMN_HEADERS.length; c++) {
      sheet.getColumn(c + 1).width = columnWidth(
        COLUMN_HEADERS[c].length,
        [],
        WIDTH_BOUNDS[c]?.min ?? DEFAULT_MIN,
        WIDTH_BOUNDS[c]?.max ?? DEFAULT_MAX,
      );
    }
    return;
  }

  const columns = COLUMN_HEADERS.map((name) => ({ name, filterButton: true }));
  const tableRows = rows.map((r) => [
    r.no,
    r.code,
    r.entryType,
    r.itemCode,
    r.itemName,
    r.active,
    r.source,
    r.created,
    r.symbology,
    r.markdownJournal,
    r.status,
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
          r.code,
          r.entryType,
          r.itemCode,
          r.itemName,
          r.active,
          r.source,
          r.created,
          r.symbology,
          r.markdownJournal,
          r.status,
        ][c],
      ),
    );
    const bounds = WIDTH_BOUNDS[c] ?? { min: DEFAULT_MIN, max: DEFAULT_MAX };
    sheet.getColumn(c + 1).width = columnWidth(COLUMN_HEADERS[c].length, valueLengths, bounds.min, bounds.max);
  }
}

export async function buildBarcodeRegistryListXlsxBuffer(
  rows: BarcodeRegistryExportRow[],
  labels: ExcelListSheetLabels,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, rows, labels);
  return workbook.xlsx.writeBuffer();
}
