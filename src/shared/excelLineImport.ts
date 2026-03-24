import type { Item } from "../modules/items/model";
import { roundMoney } from "./commercialMoney";

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

/** Recognized header cell texts (localized + legacy English). */
export type LineImportHeaderSynonyms = {
  code: string[];
  barcode: string[];
  qty: string[];
  unitPrice: string[];
};

/** User-visible strings for the downloadable Excel template. */
export type LineImportTemplateLabels = {
  dataSheetName: string;
  instructionSheetName: string;
  columnHeaders: {
    itemCode: string;
    qty: string;
    unitPrice: string;
  };
  instructionTitle: string;
  /** One string per instruction line (typically 5). */
  instructionLines: string[];
};

export type LineImportParseLabels = {
  workbookNoWorksheets: string;
  headerSynonyms: LineImportHeaderSynonyms;
  buildHeaderValidationError: (
    kind: "missing_qty" | "missing_identifier",
    detectedHeaders: string[],
  ) => string;
  rowReasons: {
    missingItemCodeBarcode: string;
    qtyMustBePositive: string;
    unitPriceNumericNonNegative: string;
  };
};

type HeaderMap = {
  codeCol: number | null;
  barcodeCol: number | null;
  qtyCol: number;
  unitPriceCol: number | null;
};

export type ParseOptions = {
  items: Item[];
  getDefaultUnitPrice: (item: Item) => number;
  labels: LineImportParseLabels;
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellMatchesSynonyms(cellText: string, synonyms: string[]): boolean {
  const n = normalizeHeader(cellText);
  if (!n) return false;
  for (const syn of synonyms) {
    if (normalizeHeader(syn) === n) return true;
  }
  return false;
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

function parseHeaderMap(
  worksheet: {
    getRow: (row: number) => {
      cellCount: number;
      getCell: (col: number) => { value: unknown };
    };
  },
  labels: LineImportParseLabels,
): HeaderMap {
  const row1 = worksheet.getRow(1);
  const detectedHeaders = collectDetectedHeaders(row1);
  let codeCol: number | null = null;
  let barcodeCol: number | null = null;
  let qtyCol: number | null = null;
  let unitPriceCol: number | null = null;
  const syn = labels.headerSynonyms;

  for (let c = 1; c <= row1.cellCount; c++) {
    const raw = toText(row1.getCell(c).value);
    if (!normalizeHeader(raw)) continue;
    if (cellMatchesSynonyms(raw, syn.code) && codeCol == null) {
      codeCol = c;
      continue;
    }
    if (cellMatchesSynonyms(raw, syn.barcode) && barcodeCol == null) {
      barcodeCol = c;
      continue;
    }
    if (cellMatchesSynonyms(raw, syn.qty) && qtyCol == null) {
      qtyCol = c;
      continue;
    }
    if (cellMatchesSynonyms(raw, syn.unitPrice) && unitPriceCol == null) {
      unitPriceCol = c;
      continue;
    }
  }

  if (qtyCol == null) {
    throw new Error(labels.buildHeaderValidationError("missing_qty", detectedHeaders));
  }
  if (codeCol == null && barcodeCol == null) {
    throw new Error(
      labels.buildHeaderValidationError("missing_identifier", detectedHeaders),
    );
  }

  return {
    codeCol,
    barcodeCol,
    qtyCol,
    unitPriceCol,
  };
}

export async function buildLineImportTemplateXlsxBuffer(
  labels: LineImportTemplateLabels,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(labels.dataSheetName);
  const { itemCode, qty, unitPrice } = labels.columnHeaders;
  sheet.columns = [
    { header: itemCode, key: "itemCode", width: 24 },
    { header: qty, key: "qty", width: 10 },
    { header: unitPrice, key: "unitPrice", width: 14 },
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

  const instructions = workbook.addWorksheet(labels.instructionSheetName);
  instructions.getCell("A1").value = labels.instructionTitle;
  instructions.getCell("A1").font = { bold: true };
  labels.instructionLines.forEach((line, i) => {
    instructions.getCell(`A${i + 3}`).value = line;
  });
  instructions.columns = [{ width: 90 }];

  return workbook.xlsx.writeBuffer();
}

export async function parseExcelLineImport(
  buffer: ArrayBuffer,
  options: ParseOptions,
): Promise<ExcelImportPreview> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error(options.labels.workbookNoWorksheets);

  const header = parseHeaderMap(worksheet, options.labels);
  const codeMap = new Map<string, Item>();
  const barcodeMap = new Map<string, Item>();
  for (const item of options.items) {
    const code = item.code.trim().toLowerCase();
    if (code && !codeMap.has(code)) codeMap.set(code, item);
    for (const bc of item.barcodes ?? []) {
      const barcode = bc.codeValue?.trim();
      if (barcode && !barcodeMap.has(barcode)) barcodeMap.set(barcode, item);
    }
    const legacyBarcode = item.barcode?.trim();
    if (legacyBarcode && !barcodeMap.has(legacyBarcode)) barcodeMap.set(legacyBarcode, item);
  }

  const rows: ExcelImportPreviewRow[] = [];
  let validRows = 0;
  let inactiveRows = 0;
  let notFoundRows = 0;
  let invalidQuantityRows = 0;
  let invalidFormatRows = 0;
  const grouped = new Map<string, ExcelImportGroupedValid>();
  const rr = options.labels.rowReasons;

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
        reason: rr.missingItemCodeBarcode,
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
        reason: rr.qtyMustBePositive,
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
          reason: rr.unitPriceNumericNonNegative,
          itemId: matched.id,
          itemCode: matched.code,
          itemName: matched.name,
        });
        invalidFormatRows++;
        continue;
      }
      unitPrice = roundMoney(parsed);
    } else {
      unitPrice = roundMoney(options.getDefaultUnitPrice(matched));
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
