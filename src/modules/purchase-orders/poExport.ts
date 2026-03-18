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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportLinesToXlsx(rows: PoExportLineRow[], filename: string): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addLinesSheet(workbook, rows, "Lines");
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

export async function exportDocumentToXlsx(
  summary: PoDocumentSummary,
  lineRows: PoExportLineRow[],
  filename: string,
): Promise<void> {
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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}
