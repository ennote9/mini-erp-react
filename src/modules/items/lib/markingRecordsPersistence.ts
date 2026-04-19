/**
 * JSON persistence for item marking records: AppLocalData items/marking-records.json
 * Envelope: { version, records } — mirrors labels persistence style.
 */
import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";
import type { ItemMarkingRecord } from "../model/itemMarkingRecord";
import { normalizeItemMarkingRecord } from "./normalizeItemMarkingRecord";

const BD = BaseDirectory.AppLocalData;
const RELATIVE_PATH = "items/marking-records.json";
const TMP_PATH = "items/marking-records.json.tmp";

export const ITEM_MARKING_RECORDS_PERSIST_VERSION = 1 as const;

type Envelope = {
  version: typeof ITEM_MARKING_RECORDS_PERSIST_VERSION;
  records: ItemMarkingRecord[];
};

const LS_PREFIX = "mini-erp-item-marking-records-v1:";
const LS_PROBE = "__mini_erp_item_marking_ls_probe__";

function localStorageKey(): string {
  return `${LS_PREFIX}${RELATIVE_PATH}`;
}

function probeLocalStorageWritable(): boolean {
  try {
    localStorage.setItem(LS_PROBE, "1");
    localStorage.removeItem(LS_PROBE);
    return true;
  } catch {
    return false;
  }
}

function parseEnvelopeText(text: string): ItemMarkingRecord[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const rec = parsed as Partial<Envelope> | null;
  const recordsRaw = rec?.records;
  const shapeValid =
    rec != null &&
    typeof rec === "object" &&
    rec.version === ITEM_MARKING_RECORDS_PERSIST_VERSION &&
    Array.isArray(recordsRaw);
  if (!shapeValid) return null;
  const normalized = recordsRaw.map(normalizeItemMarkingRecord).filter((x): x is ItemMarkingRecord => x !== null);
  if (normalized.length === 0 && recordsRaw.length > 0) return null;
  return normalized;
}

function loadFromLocalStorage(): ItemMarkingRecord[] | null {
  try {
    const text = localStorage.getItem(localStorageKey());
    if (!text) return null;
    return parseEnvelopeText(text);
  } catch {
    return null;
  }
}

function saveToLocalStorage(records: ItemMarkingRecord[]): boolean {
  try {
    const payload: Envelope = { version: ITEM_MARKING_RECORDS_PERSIST_VERSION, records };
    localStorage.setItem(localStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function writeItemMarkingRecordsPayload(records: ItemMarkingRecord[]): Promise<void> {
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const payload: Envelope = { version: ITEM_MARKING_RECORDS_PERSIST_VERSION, records };
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    await writeFile(TMP_PATH, bytes, { baseDir: BD });
    const mainExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (mainExists) {
      await remove(RELATIVE_PATH, { baseDir: BD });
    }
    await rename(TMP_PATH, RELATIVE_PATH, { oldPathBaseDir: BD, newPathBaseDir: BD });
    saveToLocalStorage(records);
  } catch (e) {
    if (saveToLocalStorage(records)) return;
    throw e;
  }
}

export type LoadItemMarkingRecordsResult = {
  records: ItemMarkingRecord[];
  diagnostics: string | null;
};

export async function loadItemMarkingRecordsPersisted(): Promise<LoadItemMarkingRecordsResult> {
  const canLs = probeLocalStorageWritable();
  const fromLs = canLs ? loadFromLocalStorage() : null;
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const fileExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (!fileExists) {
      if (fromLs) return { records: fromLs, diagnostics: null };
      return { records: [], diagnostics: null };
    }
    const bytes = await readFile(RELATIVE_PATH, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    const parsed = parseEnvelopeText(text);
    if (!parsed) {
      return {
        records: fromLs ?? [],
        diagnostics: "[itemMarkingRecords] Invalid marking-records file; using empty or local fallback.",
      };
    }
    saveToLocalStorage(parsed);
    return { records: parsed, diagnostics: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fromLs) {
      return { records: fromLs, diagnostics: `[itemMarkingRecords] File load failed; localStorage: ${msg}` };
    }
    return { records: [], diagnostics: `[itemMarkingRecords] Load failed: ${msg}` };
  }
}
