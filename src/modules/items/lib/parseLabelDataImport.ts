import type { Item } from "../model";
import type { ItemLabelDataDraft } from "./itemLabelDataBulk";
import { LABEL_DATA_FIELD_KEYS } from "./itemLabelDataBulk";

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

const HEADER_ALIASES: Record<string, keyof ItemLabelDataDraft | "code" | "barcode"> = {
  code: "code",
  itemcode: "code",
  sku: "code",
  item_code: "code",
  barcode: "barcode",
  ean: "barcode",
  gtin: "barcode",
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

/** Split TSV; fallback to comma if no tabs. */
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
  // Simple CSV: no embedded commas in MVP
  return line.split(",").map((c) => c.trim());
}

export function parseLabelDataPaste(text: string): ParseLabelDataImportResult {
  const lines = splitLines(text).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], unknownHeaders: [], rows: [] };
  }
  const delim = detectDelimiter(lines[0]);
  const headerCells = splitRow(lines[0], delim);
  const headersRaw = headerCells.map((h) => h.trim());
  const mapped: (keyof ItemLabelDataDraft | "code" | "barcode" | null)[] = [];
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

export type MatchImportPreview = {
  matched: { item: Item; row: ParsedImportRow }[];
  unmatched: { lineIndex: number; reason: string; code?: string; barcode?: string }[];
};

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

export function matchImportRows(
  rows: ParsedImportRow[],
  items: readonly Item[],
): MatchImportPreview {
  const { byCode, byBarcode } = buildItemLookup(items);
  const matched: { item: Item; row: ParsedImportRow }[] = [];
  const unmatched: MatchImportPreview["unmatched"] = [];

  for (const row of rows) {
    const code = row.rawCode?.trim().toLowerCase();
    const bc = row.rawBarcode?.trim().toLowerCase();
    let item: Item | undefined;
    if (code) item = byCode.get(code);
    if (!item && bc) item = byBarcode.get(bc);
    if (item) {
      matched.push({ item, row });
    } else {
      unmatched.push({
        lineIndex: row.lineIndex,
        reason: "not_found",
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
  return ["code", ...LABEL_DATA_FIELD_KEYS.map((k) => k)].join("\t");
}
