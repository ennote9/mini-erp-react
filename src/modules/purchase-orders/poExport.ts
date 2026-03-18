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

const LINES_HEADERS = ["№", "Item Code", "Item Name", "Brand", "Category", "Qty", "Unit Price", "Line Amount"];

function addLinesSheet(workbook: Workbook, rows: PoExportLineRow[], sheetName: string): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(LINES_HEADERS);
  for (const r of rows) {
    sheet.addRow([r.no, r.itemCode, r.itemName, r.brand, r.category, r.qty, r.unitPrice, r.lineAmount]);
  }
}

export async function buildLinesXlsxBuffer(rows: PoExportLineRow[]): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addLinesSheet(workbook, rows, "Lines");
  return workbook.xlsx.writeBuffer();
}

export async function buildDocumentXlsxBuffer(
  summary: PoDocumentSummary,
  lineRows: PoExportLineRow[],
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const docSheet = workbook.addWorksheet("Document");
  docSheet.addRow(["Number", summary.number]);
  docSheet.addRow(["Date", summary.date]);
  docSheet.addRow(["Status", summary.status]);
  docSheet.addRow(["Supplier", summary.supplier]);
  docSheet.addRow(["Warehouse", summary.warehouse]);
  docSheet.addRow(["Comment", summary.comment]);
  docSheet.addRow(["Total Qty", summary.totalQty]);
  docSheet.addRow(["Total Amount", summary.totalAmount]);
  addLinesSheet(workbook, lineRows, "Lines");
  return workbook.xlsx.writeBuffer();
}
