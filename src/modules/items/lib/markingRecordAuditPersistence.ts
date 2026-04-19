/**
 * JSON persistence for marking record audit trail: AppLocalData items/marking-record-audit.json
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
import type { ItemMarkingRecordAuditEntry } from "../model/itemMarkingRecordAudit";
import { normalizeItemMarkingRecordAudit } from "./normalizeItemMarkingRecordAudit";

const BD = BaseDirectory.AppLocalData;
const RELATIVE_PATH = "items/marking-record-audit.json";
const TMP_PATH = "items/marking-record-audit.json.tmp";

export const MARKING_RECORD_AUDIT_PERSIST_VERSION = 1 as const;

type Envelope = {
  version: typeof MARKING_RECORD_AUDIT_PERSIST_VERSION;
  entries: ItemMarkingRecordAuditEntry[];
};

const LS_PREFIX = "mini-erp-marking-record-audit-v1:";
const LS_PROBE = "__mini_erp_marking_audit_ls_probe__";

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

function parseEnvelopeText(text: string): ItemMarkingRecordAuditEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const rec = parsed as Partial<Envelope> | null;
  const entriesRaw = rec?.entries;
  const shapeValid =
    rec != null &&
    typeof rec === "object" &&
    rec.version === MARKING_RECORD_AUDIT_PERSIST_VERSION &&
    Array.isArray(entriesRaw);
  if (!shapeValid) return null;
  const normalized = entriesRaw.map(normalizeItemMarkingRecordAudit).filter((x): x is ItemMarkingRecordAuditEntry => x !== null);
  if (normalized.length === 0 && entriesRaw.length > 0) return null;
  return normalized;
}

function loadFromLocalStorage(): ItemMarkingRecordAuditEntry[] | null {
  try {
    const text = localStorage.getItem(localStorageKey());
    if (!text) return null;
    return parseEnvelopeText(text);
  } catch {
    return null;
  }
}

function saveToLocalStorage(entries: ItemMarkingRecordAuditEntry[]): boolean {
  try {
    const payload: Envelope = { version: MARKING_RECORD_AUDIT_PERSIST_VERSION, entries };
    localStorage.setItem(localStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function writeMarkingRecordAuditPayload(entries: ItemMarkingRecordAuditEntry[]): Promise<void> {
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const payload: Envelope = { version: MARKING_RECORD_AUDIT_PERSIST_VERSION, entries };
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    await writeFile(TMP_PATH, bytes, { baseDir: BD });
    const mainExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (mainExists) {
      await remove(RELATIVE_PATH, { baseDir: BD });
    }
    await rename(TMP_PATH, RELATIVE_PATH, { oldPathBaseDir: BD, newPathBaseDir: BD });
    saveToLocalStorage(entries);
  } catch (e) {
    if (saveToLocalStorage(entries)) return;
    throw e;
  }
}

export type LoadMarkingRecordAuditResult = {
  entries: ItemMarkingRecordAuditEntry[];
  diagnostics: string | null;
};

export async function loadMarkingRecordAuditPersisted(): Promise<LoadMarkingRecordAuditResult> {
  const canLs = probeLocalStorageWritable();
  const fromLs = canLs ? loadFromLocalStorage() : null;
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const fileExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (!fileExists) {
      if (fromLs) return { entries: fromLs, diagnostics: null };
      return { entries: [], diagnostics: null };
    }
    const bytes = await readFile(RELATIVE_PATH, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    const parsed = parseEnvelopeText(text);
    if (!parsed) {
      return {
        entries: fromLs ?? [],
        diagnostics: "[markingRecordAudit] Invalid audit file; using empty or local fallback.",
      };
    }
    saveToLocalStorage(parsed);
    return { entries: parsed, diagnostics: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fromLs) {
      return { entries: fromLs, diagnostics: `[markingRecordAudit] File load failed; localStorage: ${msg}` };
    }
    return { entries: [], diagnostics: `[markingRecordAudit] Load failed: ${msg}` };
  }
}
