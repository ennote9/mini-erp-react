import type { Item } from "../model";
import type { ItemLabelDataDraft } from "./itemLabelDataBulk";
import { itemToLabelDataDraft, LABEL_DATA_FIELD_KEYS, primaryBarcodeValue } from "./itemLabelDataBulk";

export type ParsedImportRow = {
  lineIndex: number;
  rawCode?: string;
  rawBarcode?: string;
  fields: Partial<ItemLabelDataDraft>;
};

export type ParseLabelDataImportResult = {
  headers: string[];
  unknownHeaders: string[];
  rows: ParsedImportRow[];
};

const HEADER_ALIASES: Record<string, keyof ItemLabelDataDraft | "code" | "barcode" | "__ignore__"> = {
  code: "code",
  itemcode: "code",
  sku: "code",
  item_code: "code",
  barcode: "barcode",
  ean: "barcode",
  gtin: "barcode",
  /** Exported for convenience; not applied on import */
  name: "__ignore__",
  itemname: "__ignore__",
  primarybarcode: "__ignore__",
  translationname: "translationName",
  translationdescription: "translationDescription",
  translationcomposition: "translationComposition",
  translationcountry: "translationCountry",
  translationimporter: "translationImporter",
  translationextratext: "translationExtraText",
  markingcode: "markingCode",
  kizcode: "kizCode",
  kiz: "kizCode",
  datamatrixpayload: "dataMatrixPayload",
  datamatrix: "dataMatrixPayload",
  gs1datamatrixpayload: "gs1DataMatrixPayload",
  gs1datamatrix: "gs1DataMatrixPayload",
  markingcomment: "markingComment",
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
}

function detectDelimiter(firstLine: string): "\t" | "," {
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs >= commas && tabs > 0 ? "\t" : ",";
}

function splitRow(line: string, delim: "\t" | ","): string[] {
  if (delim === "\t") return line.split("\t").map((c) => c.trim());
  return line.split(",").map((c) => c.trim());
}

export type ParseLabelDataTextOptions = {
  /** When set, skips auto-detection (e.g. `.csv` → comma, `.tsv` → tab). */
  delimiter?: "\t" | ",";
};

/**
 * Parse TSV/CSV-like text (paste or file contents). First non-empty line = headers.
 */
export function parseLabelDataText(text: string, options?: ParseLabelDataTextOptions): ParseLabelDataImportResult {
  const lines = splitLines(text).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], unknownHeaders: [], rows: [] };
  }
  const delim = options?.delimiter ?? detectDelimiter(lines[0]);
  const headerCells = splitRow(lines[0], delim);
  const headersRaw = headerCells.map((h) => h.trim());
  const mapped: (keyof ItemLabelDataDraft | "code" | "barcode" | "__ignore__" | null)[] = [];
  const unknownHeaders: string[] = [];

  for (const h of headersRaw) {
    const n = normalizeHeader(h);
    if (!n) {
      mapped.push(null);
      continue;
    }
    const alias = HEADER_ALIASES[n];
    if (alias === undefined) {
      if (n.length > 0) unknownHeaders.push(h);
      mapped.push(null);
    } else {
      mapped.push(alias);
    }
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = splitRow(line, delim);
    let rawCode: string | undefined;
    let rawBarcode: string | undefined;
    const fields: Partial<ItemLabelDataDraft> = {};

    for (let c = 0; c < mapped.length; c++) {
      const key = mapped[c];
      const val = cells[c]?.trim() ?? "";
      if (key === null || key === undefined) continue;
      if (key === "__ignore__") continue;
      if (key === "code") {
        rawCode = val;
        continue;
      }
      if (key === "barcode") {
        rawBarcode = val;
        continue;
      }
      fields[key] = val;
    }

    if (!rawCode?.trim() && !rawBarcode?.trim()) continue;

    rows.push({
      lineIndex: i + 1,
      rawCode: rawCode?.trim(),
      rawBarcode: rawBarcode?.trim(),
      fields,
    });
  }

  return { headers: headersRaw, unknownHeaders: [...new Set(unknownHeaders)], rows };
}

/** @deprecated use {@link parseLabelDataText} */
export function parseLabelDataPaste(text: string): ParseLabelDataImportResult {
  return parseLabelDataText(text);
}

/** Guess delimiter from file name for open-file workflow. */
export function delimiterHintFromFilename(filename: string): "\t" | "," | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tsv")) return "\t";
  if (lower.endsWith(".csv")) return ",";
  return undefined;
}

export function buildItemLookup(items: readonly Item[]): {
  byCode: Map<string, Item>;
  byBarcode: Map<string, Item>;
} {
  const byCode = new Map<string, Item>();
  const byBarcode = new Map<string, Item>();
  for (const it of items) {
    byCode.set(it.code.trim().toLowerCase(), it);
    for (const b of it.barcodes ?? []) {
      if (!b.isActive) continue;
      const k = b.codeValue.trim().toLowerCase();
      if (!byBarcode.has(k)) byBarcode.set(k, it);
    }
  }
  return { byCode, byBarcode };
}

/** All items sharing an active barcode value (for ambiguity detection). */
export function buildBarcodeToItemsMap(items: readonly Item[]): Map<string, Item[]> {
  const m = new Map<string, Item[]>();
  for (const it of items) {
    for (const b of it.barcodes ?? []) {
      if (!b.isActive) continue;
      const k = b.codeValue.trim().toLowerCase();
      const arr = m.get(k) ?? [];
      const seen = new Set(arr.map((x) => x.id));
      if (!seen.has(it.id)) arr.push(it);
      m.set(k, arr);
    }
  }
  return m;
}

function dedupeItemsById(list: Item[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const it of list) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/** Matching key within file: code preferred, else barcode. */
export function importRowMatchKey(row: ParsedImportRow): string | null {
  const c = row.rawCode?.trim().toLowerCase();
  if (c) return `c:${c}`;
  const b = row.rawBarcode?.trim().toLowerCase();
  if (b) return `b:${b}`;
  return null;
}

export type RowMatchResult =
  | { kind: "found"; item: Item }
  | { kind: "not_found" }
  | { kind: "ambiguous"; candidates: Item[] };

export function matchSingleImportRow(
  row: ParsedImportRow,
  byCode: Map<string, Item>,
  barcodeToItems: Map<string, Item[]>,
): RowMatchResult {
  const code = row.rawCode?.trim().toLowerCase();
  if (code) {
    const item = byCode.get(code);
    return item ? { kind: "found", item } : { kind: "not_found" };
  }
  const bc = row.rawBarcode?.trim().toLowerCase();
  if (bc) {
    const list = dedupeItemsById(barcodeToItems.get(bc) ?? []);
    if (list.length === 0) return { kind: "not_found" };
    if (list.length === 1) return { kind: "found", item: list[0] };
    return { kind: "ambiguous", candidates: list };
  }
  return { kind: "not_found" };
}

export type MergeRowsConflict = {
  field: keyof ItemLabelDataDraft;
  first: string;
  second: string;
};

export function mergeImportRowFields(rows: ParsedImportRow[]): {
  merged: Partial<ItemLabelDataDraft>;
  conflict?: MergeRowsConflict;
} {
  const sorted = [...rows].sort((a, b) => a.lineIndex - b.lineIndex);
  const merged: Partial<ItemLabelDataDraft> = {};
  for (const row of sorted) {
    for (const k of LABEL_DATA_FIELD_KEYS) {
      const v = row.fields[k]?.trim() ?? "";
      if (!v) continue;
      const cur = merged[k];
      if (cur === undefined) {
        merged[k] = v;
        continue;
      }
      if (cur !== v) {
        return { merged, conflict: { field: k, first: cur, second: v } };
      }
    }
  }
  return { merged };
}

export type LabelDataImportConflict = {
  item: Item;
  lineIndices: number[];
  field: keyof ItemLabelDataDraft;
  values: [string, string];
};

export type LabelDataImportAnalysis = {
  sourceRowCount: number;
  unknownHeaderCount: number;
  unknownHeaders: string[];
  duplicateKeyRowCount: number;
  duplicateKeyLineIndices: number[];
  ambiguousRowCount: number;
  ambiguous: { row: ParsedImportRow; candidates: Item[] }[];
  notFoundRowCount: number;
  notFound: ParsedImportRow[];
  conflictRowCount: number;
  conflicts: LabelDataImportConflict[];
  /** Items that will receive merged import values */
  applicable: { item: Item; mergedFields: Partial<ItemLabelDataDraft>; sourceRows: ParsedImportRow[] }[];
};

/**
 * Full import analysis: duplicate keys in file, match, ambiguity, merge conflicts.
 * Only {@link LabelDataImportAnalysis.applicable} should be applied to drafts.
 */
export function analyzeLabelDataImport(
  parsed: Pick<ParseLabelDataImportResult, "rows" | "unknownHeaders">,
  items: readonly Item[],
): LabelDataImportAnalysis {
  const rows = parsed.rows;
  const byCode = buildItemLookup(items).byCode;
  const barcodeToItems = buildBarcodeToItemsMap(items);

  const keyToRows = new Map<string, ParsedImportRow[]>();
  for (const row of rows) {
    const k = importRowMatchKey(row);
    if (!k) continue;
    keyToRows.set(k, [...(keyToRows.get(k) ?? []), row]);
  }

  const duplicateLineIndices = new Set<number>();
  for (const [, list] of keyToRows) {
    if (list.length > 1) {
      for (const r of list) duplicateLineIndices.add(r.lineIndex);
    }
  }

  const remaining = rows.filter((r) => !duplicateLineIndices.has(r.lineIndex));

  const notFound: ParsedImportRow[] = [];
  const ambiguous: { row: ParsedImportRow; candidates: Item[] }[] = [];
  const byItemId = new Map<string, { item: Item; rows: ParsedImportRow[] }>();

  for (const row of remaining) {
    const m = matchSingleImportRow(row, byCode, barcodeToItems);
    if (m.kind === "not_found") {
      notFound.push(row);
      continue;
    }
    if (m.kind === "ambiguous") {
      ambiguous.push({
        row,
        candidates: m.candidates,
      });
      continue;
    }
    const item = m.item;
    const g = byItemId.get(item.id) ?? { item, rows: [] };
    g.rows.push(row);
    byItemId.set(item.id, g);
  }

  const conflicts: LabelDataImportConflict[] = [];
  const applicable: LabelDataImportAnalysis["applicable"] = [];

  for (const { item, rows: groupRows } of byItemId.values()) {
    const { merged, conflict } = mergeImportRowFields(groupRows);
    if (conflict) {
      conflicts.push({
        item,
        lineIndices: groupRows.map((r) => r.lineIndex),
        field: conflict.field,
        values: [conflict.first, conflict.second],
      });
      continue;
    }
    applicable.push({ item, mergedFields: merged, sourceRows: groupRows });
  }

  return {
    sourceRowCount: rows.length,
    unknownHeaderCount: parsed.unknownHeaders.length,
    unknownHeaders: parsed.unknownHeaders,
    duplicateKeyRowCount: duplicateLineIndices.size,
    duplicateKeyLineIndices: [...duplicateLineIndices].sort((a, b) => a - b),
    ambiguousRowCount: ambiguous.length,
    ambiguous,
    notFoundRowCount: notFound.length,
    notFound,
    conflictRowCount: conflicts.reduce((n, c) => n + c.lineIndices.length, 0),
    conflicts,
    applicable,
  };
}

export type MatchImportPreview = {
  matched: { item: Item; row: ParsedImportRow }[];
  unmatched: { lineIndex: number; reason: string; code?: string; barcode?: string }[];
};

/** Legacy: row-by-row match without duplicate/conflict analysis. Prefer {@link analyzeLabelDataImport}. */
export function matchImportRows(rows: ParsedImportRow[], items: readonly Item[]): MatchImportPreview {
  const byCode = buildItemLookup(items).byCode;
  const barcodeToItems = buildBarcodeToItemsMap(items);
  const matched: { item: Item; row: ParsedImportRow }[] = [];
  const unmatched: MatchImportPreview["unmatched"] = [];

  for (const row of rows) {
    const m = matchSingleImportRow(row, byCode, barcodeToItems);
    if (m.kind === "found") {
      matched.push({ item: m.item, row });
    } else {
      unmatched.push({
        lineIndex: row.lineIndex,
        reason: m.kind === "ambiguous" ? "ambiguous" : "not_found",
        code: row.rawCode,
        barcode: row.rawBarcode,
      });
    }
  }

  return { matched, unmatched };
}

export function mergeImportIntoDraft(
  current: ItemLabelDataDraft,
  incoming: Partial<ItemLabelDataDraft>,
): ItemLabelDataDraft {
  const next = { ...current };
  for (const k of LABEL_DATA_FIELD_KEYS) {
    if (incoming[k] !== undefined && incoming[k] !== null) {
      next[k] = String(incoming[k]);
    }
  }
  return next;
}

export function exportTemplateTsvHeader(): string {
  return ["code", "name", "primaryBarcode", ...LABEL_DATA_FIELD_KEYS.map((k) => k)].join("\t");
}

/** Template file: headers + one example row (placeholders). */
export function buildLabelDataTemplateFileContent(): string {
  const header = exportTemplateTsvHeader();
  const example = [
    "ITEM-001",
    "Example product name",
    "4600000000000",
    "Example EN name",
    "Short description",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].join("\t");
  return `\uFEFF${header}\n${example}\n`;
}

export function buildLabelDataExportTsv(
  items: readonly Item[],
  draftById: Record<string, ItemLabelDataDraft>,
): string {
  const lines: string[] = [];
  const header = exportTemplateTsvHeader();
  lines.push(header);
  for (const it of items) {
    const d = draftById[it.id] ?? itemToLabelDataDraft(it);
    const cells = [
      it.code,
      it.name,
      primaryBarcodeValue(it),
      ...LABEL_DATA_FIELD_KEYS.map((k) => d[k] ?? ""),
    ];
    lines.push(cells.map(escapeTsvCell).join("\t"));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

function escapeTsvCell(s: string): string {
  const t = String(s ?? "");
  if (/[\t\n\r"]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}
