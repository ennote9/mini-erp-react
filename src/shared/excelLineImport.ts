import type { Item } from "../modules/items/model";

export type ExcelImportRowStatus =
  | "valid"
  | "inactive"
  | "not_found"
  | "invalid_quantity"
  | "invalid_format";

export type ExcelImportPreviewRow = {
  rowNumber: number;
  sourceValue: string;
  qty: number | null;
  unitPrice: number | null;
  status: ExcelImportRowStatus;
  reason?: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
};

export type ExcelImportGroupedValid = {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPrice: number;
};

export type ExcelImportPreview = {
  totalRowsRead: number;
  validRows: number;
  inactiveRows: number;
  notFoundRows: number;
  invalidQuantityRows: number;
  invalidFormatRows: number;
  mergedDuplicates: number;
  groupedValid: ExcelImportGroupedValid[];
  rows: ExcelImportPreviewRow[];
};

type HeaderMap = {
  codeCol: number | null;
  barcodeCol: number | null;
  qtyCol: number;
  unitPriceCol: number | null;
};

type ParseOptions = {
  items: Item[];
  getDefaultUnitPrice: (item: Item) => number;
};

export async function buildLineImportTemplateXlsxBuffer(): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Lines Import");
  sheet.columns = [
    { header: "Item Code", key: "itemCode", width: 24 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Unit Price", key: "unitPrice", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  sheet.addRow({ itemCode: "ITEM-001", qty: 5, unitPrice: 7.99 });
  sheet.addRow({ itemCode: "ITEM-002", qty: 2, unitPrice: 9.5 });
  sheet.addRow({ itemCode: "ITEM-003", qty: 1, unitPrice: 12.0 });

  for (let rowIndex = 2; rowIndex <= 4; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    row.font = { color: { argb: "FF6B7280" }, italic: true };
  }

  const instructions = workbook.addWorksheet("Instructions");
  instructions.getCell("A1").value = "How to use this template";
  instructions.getCell("A1").font = { bold: true };
  instructions.getCell("A3").value = "1) Fill rows on the first worksheet: Lines Import.";
  instructions.getCell("A4").value = "2) Use Item Code values that exist in your catalog.";
  instructions.getCell("A5").value = "3) Qty is required and must be greater than 0.";
  instructions.getCell("A6").value = "4) Unit Price is optional (defaults are applied when empty).";
  instructions.getCell("A7").value = "5) Example rows are demos. Replace them with real data before import.";
  instructions.columns = [{ width: 90 }];

  return workbook.xlsx.writeBuffer();
}

type HeaderValidationKind = "missing_qty" | "missing_identifier";

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value && "text" in (value as Record<string, unknown>)) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text.trim() : "";
  }
  return String(value).trim();
}

function toPositiveNumber(value: unknown): number | null {
  const raw = toText(value);
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function collectDetectedHeaders(row1: {
  cellCount: number;
  getCell: (col: number) => { value: unknown };
}): string[] {
  const headers: string[] = [];
  for (let c = 1; c <= row1.cellCount; c++) {
    const text = toText(row1.getCell(c).value);
    if (text) headers.push(text);
  }
  return headers;
}

function buildHeaderValidationMessage(
  kind: HeaderValidationKind,
  detectedHeaders: string[],
): string {
  const detected =
    detectedHeaders.length > 0
      ? detectedHeaders.join(" | ")
      : "(row 1 appears blank)";

  const lines: string[] = [];
  lines.push("Import failed: Excel header row is not in the expected format.");
  if (kind === "missing_qty") {
    lines.push("Missing required quantity column.");
    lines.push("Expected header: Qty or Quantity.");
  } else {
    lines.push("Missing required item identifier column.");
    lines.push(
      "Expected one of: Item Code, Code, Barcode, Item Barcode.",
    );
  }
  lines.push(`Detected headers (row 1): ${detected}`);
  lines.push(
    "Tip: header row must be in row 1 and each header should be in a separate column.",
  );
  lines.push("Example: Item Code | Qty");
  lines.push("         ITEM-001 | 5");

  const normalizedDetected = detectedHeaders.map((h) => normalizeHeader(h));
  if (
    normalizedDetected.some((h) => h.includes("item") && h.includes("barcode"))
  ) {
    lines.push(
      "Hint: one column seems to combine labels. Split headers into separate columns.",
    );
  }
  if (
    kind === "missing_qty" &&
    normalizedDetected.some((h) => h.includes("qty") || h.includes("quant"))
  ) {
    lines.push(
      "Hint: quantity header may be misspelled. Use exactly Qty or Quantity.",
    );
  }

  return lines.join("\n");
}

function parseHeaderMap(worksheet: { getRow: (row: number) => { cellCount: number; getCell: (col: number) => { value: unknown } } }): HeaderMap {
  const row1 = worksheet.getRow(1);
  const detectedHeaders = collectDetectedHeaders(row1);
  let codeCol: number | null = null;
  let barcodeCol: number | null = null;
  let qtyCol: number | null = null;
  let unitPriceCol: number | null = null;

  for (let c = 1; c <= row1.cellCount; c++) {
    const h = normalizeHeader(toText(row1.getCell(c).value));
    if (!h) continue;
    if ((h === "item code" || h === "code") && codeCol == null) {
      codeCol = c;
      continue;
    }
    if ((h === "barcode" || h === "item barcode") && barcodeCol == null) {
      barcodeCol = c;
      continue;
    }
    if ((h === "qty" || h === "quantity") && qtyCol == null) {
      qtyCol = c;
      continue;
    }
    if ((h === "unit price" || h === "price") && unitPriceCol == null) {
      unitPriceCol = c;
      continue;
    }
  }

  if (qtyCol == null) {
    throw new Error(buildHeaderValidationMessage("missing_qty", detectedHeaders));
  }
  if (codeCol == null && barcodeCol == null) {
    throw new Error(buildHeaderValidationMessage("missing_identifier", detectedHeaders));
  }

  return {
    codeCol,
    barcodeCol,
    qtyCol,
    unitPriceCol,
  };
}

export async function parseExcelLineImport(
  buffer: ArrayBuffer,
  options: ParseOptions,
): Promise<ExcelImportPreview> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel import: workbook has no worksheets.");

  const header = parseHeaderMap(worksheet);
  const codeMap = new Map<string, Item>();
  const barcodeMap = new Map<string, Item>();
  for (const item of options.items) {
    const code = item.code.trim().toLowerCase();
    if (code && !codeMap.has(code)) codeMap.set(code, item);
    const barcode = item.barcode?.trim();
    if (barcode && !barcodeMap.has(barcode)) barcodeMap.set(barcode, item);
  }

  const rows: ExcelImportPreviewRow[] = [];
  let validRows = 0;
  let inactiveRows = 0;
  let notFoundRows = 0;
  let invalidQuantityRows = 0;
  let invalidFormatRows = 0;
  const grouped = new Map<string, ExcelImportGroupedValid>();

  for (let r = 2; r <= worksheet.actualRowCount; r++) {
    const row = worksheet.getRow(r);
    const codeRaw = header.codeCol != null ? toText(row.getCell(header.codeCol).value) : "";
    const barcodeRaw =
      header.barcodeCol != null ? toText(row.getCell(header.barcodeCol).value) : "";
    const qtyRaw = row.getCell(header.qtyCol).value;
    const unitPriceRaw =
      header.unitPriceCol != null ? row.getCell(header.unitPriceCol).value : null;

    if (!codeRaw && !barcodeRaw && !toText(qtyRaw) && !toText(unitPriceRaw)) {
      continue;
    }

    const sourceValue = codeRaw || barcodeRaw;
    if (!sourceValue) {
      rows.push({
        rowNumber: r,
        sourceValue: "",
        qty: null,
        unitPrice: null,
        status: "invalid_format",
        reason: "Missing item code/barcode.",
      });
      invalidFormatRows++;
      continue;
    }

    const qty = toPositiveNumber(qtyRaw);
    if (qty == null) {
      rows.push({
        rowNumber: r,
        sourceValue,
        qty: null,
        unitPrice: null,
        status: "invalid_quantity",
        reason: "Quantity must be a numeric value greater than 0.",
      });
      invalidQuantityRows++;
      continue;
    }

    const byCode = codeMap.get(sourceValue.toLowerCase());
    const byBarcode = barcodeMap.get(sourceValue);
    const matched = byCode ?? byBarcode;
    if (!matched) {
      rows.push({
        rowNumber: r,
        sourceValue,
        qty,
        unitPrice: null,
        status: "not_found",
      });
      notFoundRows++;
      continue;
    }

    if (!matched.isActive) {
      rows.push({
        rowNumber: r,
        sourceValue,
        qty,
        unitPrice: null,
        status: "inactive",
        itemId: matched.id,
        itemCode: matched.code,
        itemName: matched.name,
      });
      inactiveRows++;
      continue;
    }

    const importedPriceText = toText(unitPriceRaw);
    let unitPrice: number;
    if (importedPriceText) {
      const parsed = Number(importedPriceText);
      if (!Number.isFinite(parsed) || parsed < 0) {
        rows.push({
          rowNumber: r,
          sourceValue,
          qty,
          unitPrice: null,
          status: "invalid_format",
          reason: "Unit price must be numeric and >= 0.",
          itemId: matched.id,
          itemCode: matched.code,
          itemName: matched.name,
        });
        invalidFormatRows++;
        continue;
      }
      unitPrice = parsed;
    } else {
      unitPrice = options.getDefaultUnitPrice(matched);
    }

    rows.push({
      rowNumber: r,
      sourceValue,
      qty,
      unitPrice,
      status: "valid",
      itemId: matched.id,
      itemCode: matched.code,
      itemName: matched.name,
    });
    validRows++;

    const existing = grouped.get(matched.id);
    if (existing) {
      existing.qty += qty;
    } else {
      grouped.set(matched.id, {
        itemId: matched.id,
        itemCode: matched.code,
        itemName: matched.name,
        qty,
        unitPrice,
      });
    }
  }

  const groupedValid = [...grouped.values()];
  return {
    totalRowsRead: rows.length,
    validRows,
    inactiveRows,
    notFoundRows,
    invalidQuantityRows,
    invalidFormatRows,
    mergedDuplicates: validRows - groupedValid.length,
    groupedValid,
    rows,
  };
}
