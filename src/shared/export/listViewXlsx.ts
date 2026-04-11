import type { Workbook } from "exceljs";

type BuildListViewXlsxInput = {
  sheetName: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  tableNameBase: string;
};

const WIDTH_PADDING = 1.5;
const DEFAULT_MIN_WIDTH = 8;
const DEFAULT_MAX_WIDTH = 60;

function columnWidthFromLengths(headerLength: number, valueLengths: number[]): number {
  const maxVal = valueLengths.length > 0 ? Math.max(...valueLengths) : 0;
  const width = Math.max(headerLength, maxVal) + WIDTH_PADDING;
  return Math.min(DEFAULT_MAX_WIDTH, Math.max(DEFAULT_MIN_WIDTH, Math.ceil(width)));
}

function sanitizeTableName(name: string): string {
  if (!name) return "Table1";
  let out = name.replace(/[^a-zA-Z0-9._]/g, "_");
  if (/^[0-9.]/.test(out)) out = `T${out}`;
  if (out.length > 200) out = out.slice(0, 200);
  return out || "Table1";
}

function addSheet(workbook: Workbook, input: BuildListViewXlsxInput): void {
  const { sheetName, headers, rows, tableNameBase } = input;
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen" as const, ySplit: 1 }],
  });

  if (rows.length === 0) {
    sheet.addRow(headers);
  } else {
    sheet.addTable({
      name: sanitizeTableName(tableNameBase),
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows,
    });
  }

  for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
    const lengths = rows.map((row) => String(row[colIndex] ?? "").length);
    sheet.getColumn(colIndex + 1).width = columnWidthFromLengths(headers[colIndex]?.length ?? 0, lengths);
  }
}

export async function buildListViewXlsxBuffer(input: BuildListViewXlsxInput): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, input);
  return workbook.xlsx.writeBuffer();
}
