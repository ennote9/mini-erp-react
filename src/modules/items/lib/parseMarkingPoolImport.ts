/**
 * Parse TSV/CSV/paste/grid for bulk marking pool import.
 * Reuses line-splitting style from {@link parseLabelDataImport}; column mapping is marking-specific.
 */
import type { ItemMarkingRecordKind, ItemMarkingRecordSource } from "../model/itemMarkingRecord";
import type { ParsedImportRow } from "./parseLabelDataImport";

export type ParsedMarkingPoolRow = {
  lineIndex: number;
  rawCode?: string;
  rawBarcode?: string;
  markingKind: ItemMarkingRecordKind | null;
  payload: string;
  humanLabel?: string;
  serial?: string;
  batchRef?: string;
  source?: ItemMarkingRecordSource;
  note?: string;
};

export type ParseMarkingPoolImportResult = {
  headers: string[];
  unknownHeaders: string[];
  rows: ParsedMarkingPoolRow[];
};

const KIND_ALIASES: Record<string, ItemMarkingRecordKind> = {
  marking: "MARKING",
  mark: "MARKING",
  kiz: "KIZ",
  datamatrix: "DATAMATRIX",
  dm: "DATAMATRIX",
  gs1datamatrix: "GS1_DATAMATRIX",
  gs1_dm: "GS1_DATAMATRIX",
  gs1: "GS1_DATAMATRIX",
};

function parseKindToken(raw: string): ItemMarkingRecordKind | null {
  const t = raw.trim();
  if (!t) return null;
  const up = t.toUpperCase().replace(/\s+/g, "_");
  if (up === "MARKING" || up === "KIZ" || up === "DATAMATRIX" || up === "GS1_DATAMATRIX") {
    return up as ItemMarkingRecordKind;
  }
  const n = t.toLowerCase().replace(/\s+/g, "");
  return KIND_ALIASES[n] ?? null;
}

function parseSourceToken(raw: string): ItemMarkingRecordSource | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const up = t.toUpperCase();
  if (up === "MANUAL" || up === "IMPORT" || up === "GENERATED" || up === "OTHER") {
    return up as ItemMarkingRecordSource;
  }
  return undefined;
}

type HeaderKey =
  | "code"
  | "barcode"
  | "markingKind"
  | "payload"
  | "humanLabel"
  | "serial"
  | "batchRef"
  | "source"
  | "note"
  | "__ignore__"
  | null;

const HEADER_ALIASES: Record<string, HeaderKey> = {
  code: "code",
  itemcode: "code",
  sku: "code",
  articlenumber: "code",
  barcode: "barcode",
  ean: "barcode",
  gtin: "barcode",
  upc: "barcode",
  markingkind: "markingKind",
  kind: "markingKind",
  type: "markingKind",
  marking_type: "markingKind",
  payload: "payload",
  value: "payload",
  markingcode: "payload",
  humanlabel: "humanLabel",
  label: "humanLabel",
  serial: "serial",
  batchref: "batchRef",
  batch: "batchRef",
  source: "source",
  note: "note",
  comment: "note",
  name: "__ignore__",
  itemname: "__ignore__",
  productname: "__ignore__",
};

const HEADER_ALIASES_FULL: Record<string, HeaderKey> = {
  ...HEADER_ALIASES,
  "item code": "code",
  "marking kind": "markingKind",
  "human label": "humanLabel",
  "batch ref": "batchRef",
  код: "code",
  штрихкод: "barcode",
  видмаркировки: "markingKind",
  тип: "markingKind",
  payload: "payload",
  подпись: "humanLabel",
  серийный: "serial",
  партия: "batchRef",
  источник: "source",
  примечание: "note",
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_а-яё]/gi, "");
}

function resolveHeaderAlias(raw: string): HeaderKey | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const full = t.toLowerCase();
  const fm = HEADER_ALIASES_FULL[full];
  if (fm !== undefined) return fm;
  const n = normalizeHeader(t);
  return HEADER_ALIASES[n];
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

function buildColumnMapping(headersRaw: string[]): {
  mapped: (HeaderKey | null)[];
  unknownHeaders: string[];
} {
  const mapped: (HeaderKey | null)[] = [];
  const unknownHeaders: string[] = [];
  for (const h of headersRaw) {
    const trimmed = h.trim();
    if (!trimmed) {
      mapped.push(null);
      continue;
    }
    const alias = resolveHeaderAlias(trimmed);
    if (alias === undefined) {
      unknownHeaders.push(trimmed);
      mapped.push(null);
    } else {
      mapped.push(alias);
    }
  }
  return { mapped, unknownHeaders: [...new Set(unknownHeaders)] };
}

function parseRowCells(
  mapped: (HeaderKey | null)[],
  cells: string[],
  lineIndex: number,
): ParsedMarkingPoolRow | null {
  let rawCode: string | undefined;
  let rawBarcode: string | undefined;
  let markingKind: ItemMarkingRecordKind | null = null;
  let payload = "";
  let humanLabel: string | undefined;
  let serial: string | undefined;
  let batchRef: string | undefined;
  let source: ItemMarkingRecordSource | undefined;
  let note: string | undefined;

  for (let c = 0; c < mapped.length; c++) {
    const key = mapped[c];
    const val = (cells[c] ?? "").trim();
    if (key === null || key === undefined || key === "__ignore__") continue;
    switch (key) {
      case "code":
        rawCode = val;
        break;
      case "barcode":
        rawBarcode = val;
        break;
      case "markingKind":
        markingKind = val ? parseKindToken(val) : null;
        break;
      case "payload":
        payload = val;
        break;
      case "humanLabel":
        humanLabel = val || undefined;
        break;
      case "serial":
        serial = val || undefined;
        break;
      case "batchRef":
        batchRef = val || undefined;
        break;
      case "source":
        source = parseSourceToken(val);
        break;
      case "note":
        note = val || undefined;
        break;
      default: {
        const _ex: never = key;
        return _ex;
      }
    }
  }

  if (!rawCode?.trim() && !rawBarcode?.trim()) return null;

  return {
    lineIndex,
    rawCode: rawCode?.trim(),
    rawBarcode: rawBarcode?.trim(),
    markingKind,
    payload: payload.trim(),
    humanLabel,
    serial,
    batchRef,
    source,
    note,
  };
}

export function parseMarkingPoolFromGrid(
  headerRow: string[],
  dataRows: string[][],
  firstDataLineIndex: number,
): ParseMarkingPoolImportResult {
  const headersRaw = headerRow.map((h) => String(h ?? "").trim());
  const { mapped, unknownHeaders } = buildColumnMapping(headersRaw);
  const rows: ParsedMarkingPoolRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i] ?? [];
    if (cells.every((c) => !String(c ?? "").trim())) continue;
    const lineIndex = firstDataLineIndex + i;
    const parsed = parseRowCells(mapped, cells.map((c) => String(c ?? "")), lineIndex);
    if (parsed) rows.push(parsed);
  }

  return { headers: headersRaw, unknownHeaders, rows };
}

export type ParseMarkingPoolTextOptions = {
  delimiter?: "\t" | ",";
};

export function parseMarkingPoolText(text: string, options?: ParseMarkingPoolTextOptions): ParseMarkingPoolImportResult {
  const lines = splitLines(text).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], unknownHeaders: [], rows: [] };
  }
  const delim = options?.delimiter ?? detectDelimiter(lines[0]);
  const headerCells = splitRow(lines[0], delim);
  const dataRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    dataRows.push(splitRow(line, delim));
  }
  return parseMarkingPoolFromGrid(headerCells.map((h) => h.trim()), dataRows, 2);
}

export { delimiterHintFromFilename } from "./parseLabelDataImport";

/** For item matching — same shape as label-data import. */
export function markingRowToMatchImportRow(row: ParsedMarkingPoolRow): ParsedImportRow {
  return {
    lineIndex: row.lineIndex,
    rawCode: row.rawCode,
    rawBarcode: row.rawBarcode,
    fields: {},
  };
}
