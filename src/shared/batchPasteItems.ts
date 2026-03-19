import type { Item } from "../modules/items/model";

export type BatchPasteResolutionStatus =
  | "valid"
  | "inactive"
  | "not_found"
  | "invalid_quantity"
  | "invalid_format"
  | "header_skipped";

export type BatchPasteResolutionRow = {
  input: string;
  token: string;
  status: BatchPasteResolutionStatus;
  qty: number | null;
  note?: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
};

export type BatchPasteGroupedValid = {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
};

export type BatchPastePreview = {
  totalLines: number;
  validMatchCount: number;
  inactiveCount: number;
  notFoundCount: number;
  invalidQuantityCount: number;
  invalidFormatCount: number;
  headerSkippedCount: number;
  extraColumnsIgnoredCount: number;
  mergedDuplicateCount: number;
  groupedValid: BatchPasteGroupedValid[];
  rows: BatchPasteResolutionRow[];
};

function normalizeHeaderCell(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isLikelyHeaderRow(token: string, qtyToken: string): boolean {
  const left = normalizeHeaderCell(token);
  const right = normalizeHeaderCell(qtyToken);
  const leftIsHeader =
    left === "code" ||
    left === "item code" ||
    left === "barcode" ||
    left === "item barcode" ||
    left === "item";
  const rightIsHeader = right === "qty" || right === "quantity";
  return leftIsHeader && rightIsHeader;
}

function parseLine(
  rawLine: string,
): {
  token: string;
  qty: number | null;
  parseStatus: "ok" | "invalid_format" | "invalid_quantity" | "header_skipped";
  note?: string;
} | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  if (rawLine.includes("\t")) {
    const cells = rawLine.split("\t");
    const token = (cells[0] ?? "").trim();
    const qtyTokenRaw = (cells[1] ?? "").trim();
    if (!token) {
      return { token: "", qty: null, parseStatus: "invalid_format" };
    }
    if (isLikelyHeaderRow(token, qtyTokenRaw)) {
      return { token, qty: null, parseStatus: "header_skipped" };
    }

    const qtyToken = qtyTokenRaw === "" ? "1" : qtyTokenRaw;
    const parsedQty = Number(qtyToken);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return { token, qty: null, parseStatus: "invalid_quantity" };
    }

    const note =
      cells.length > 2 ? "Extra columns ignored" : undefined;
    return { token, qty: parsedQty, parseStatus: "ok", note };
  }

  const parts = trimmed.split(/\s+/g);
  if (parts.length > 2) {
    return { token: parts[0], qty: null, parseStatus: "invalid_format" };
  }
  if (parts.length === 1) {
    return { token: parts[0], qty: 1, parseStatus: "ok" };
  }

  const parsedQty = Number(parts[1]);
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
    return { token: parts[0], qty: null, parseStatus: "invalid_quantity" };
  }
  return { token: parts[0], qty: parsedQty, parseStatus: "ok" };
}

export function resolveBatchPastedItems(input: string, items: Item[]): BatchPastePreview {
  const codeMap = new Map<string, Item>();
  const barcodeMap = new Map<string, Item>();
  for (const item of items) {
    const normalizedCode = item.code.trim().toLowerCase();
    if (normalizedCode && !codeMap.has(normalizedCode)) {
      codeMap.set(normalizedCode, item);
    }
    const barcode = item.barcode?.trim();
    if (barcode && !barcodeMap.has(barcode)) {
      barcodeMap.set(barcode, item);
    }
  }

  const rows: BatchPasteResolutionRow[] = [];
  let validMatchCount = 0;
  let inactiveCount = 0;
  let notFoundCount = 0;
  let invalidQuantityCount = 0;
  let invalidFormatCount = 0;
  let headerSkippedCount = 0;
  let extraColumnsIgnoredCount = 0;
  const grouped = new Map<string, BatchPasteGroupedValid>();

  const rawLines = input.split(/\r?\n/g);
  for (const raw of rawLines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const token = parsed.token;

    if (parsed.parseStatus === "invalid_format") {
      rows.push({ input: raw, token, status: "invalid_format", qty: null });
      invalidFormatCount++;
      continue;
    }
    if (parsed.parseStatus === "header_skipped") {
      rows.push({
        input: raw,
        token,
        status: "header_skipped",
        qty: null,
      });
      headerSkippedCount++;
      continue;
    }
    if (parsed.parseStatus === "invalid_quantity") {
      rows.push({ input: raw, token, status: "invalid_quantity", qty: null });
      invalidQuantityCount++;
      continue;
    }

    const qty = parsed.qty ?? 1;

    const byCode = codeMap.get(token.toLowerCase());
    const byBarcode = barcodeMap.get(token);
    const matched = byCode ?? byBarcode;

    if (!matched) {
      rows.push({ input: raw, token, status: "not_found", qty });
      notFoundCount++;
      continue;
    }

    if (!matched.isActive) {
      rows.push({
        input: raw,
        token,
        status: "inactive",
        qty,
        itemId: matched.id,
        itemCode: matched.code,
        itemName: matched.name,
      });
      inactiveCount++;
      continue;
    }

    rows.push({
      input: raw,
      token,
      status: "valid",
      qty,
      note: parsed.note,
      itemId: matched.id,
      itemCode: matched.code,
      itemName: matched.name,
    });
    validMatchCount++;
    if (parsed.note) {
      extraColumnsIgnoredCount++;
    }

    const existing = grouped.get(matched.id);
    if (existing) {
      existing.qty += qty;
    } else {
      grouped.set(matched.id, {
        itemId: matched.id,
        itemCode: matched.code,
        itemName: matched.name,
        qty,
      });
    }
  }

  const groupedValid = [...grouped.values()];
  const mergedDuplicateCount = validMatchCount - groupedValid.length;

  return {
    totalLines: rows.length,
    validMatchCount,
    inactiveCount,
    notFoundCount,
    invalidQuantityCount,
    invalidFormatCount,
    headerSkippedCount,
    extraColumnsIgnoredCount,
    mergedDuplicateCount,
    groupedValid,
    rows,
  };
}
