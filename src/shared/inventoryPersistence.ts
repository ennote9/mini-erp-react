import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { shouldUseTauriPluginFs } from "./tauriRuntime";

const BD = BaseDirectory.AppLocalData;
const INVENTORY_DIR = "inventory";
const PERSIST_VERSION = 1 as const;
const INVENTORY_LS_PREFIX = "mini-erp-inventory-v1:";
const INVENTORY_LS_PROBE_KEY = "__mini_erp_inventory_ls_probe__";

type Envelope<T> = {
  version: number;
  records: T[];
};

function localStorageKey(relativePath: string): string {
  return `${INVENTORY_LS_PREFIX}${relativePath}`;
}

function probeLocalStorageWritable(): boolean {
  try {
    localStorage.setItem(INVENTORY_LS_PROBE_KEY, "1");
    localStorage.removeItem(INVENTORY_LS_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function parseEnvelopeText<T>(text: string, normalizeRecord: (raw: unknown) => T | null): T[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const rec = parsed as Partial<Envelope<unknown>> | null;
  const recordsRaw = rec?.records;
  const shapeValid =
    rec != null &&
    typeof rec === "object" &&
    rec.version === PERSIST_VERSION &&
    Array.isArray(recordsRaw);

  if (!shapeValid) return null;

  const normalized = recordsRaw
    .map(normalizeRecord)
    .filter((x): x is T => x !== null);

  if (normalized.length === 0 && recordsRaw.length > 0) return null;
  return normalized;
}

function loadInventoryPayloadFromLocalStorage<T>(
  relativePath: string,
  normalizeRecord: (raw: unknown) => T | null,
): T[] | null {
  try {
    const text = localStorage.getItem(localStorageKey(relativePath));
    if (!text) return null;
    return parseEnvelopeText(text, normalizeRecord);
  } catch {
    return null;
  }
}

function saveInventoryPayloadToLocalStorage<T>(relativePath: string, records: T[]): boolean {
  try {
    const payload: Envelope<T> = { version: PERSIST_VERSION, records };
    localStorage.setItem(localStorageKey(relativePath), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function parentDirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

function baseFileNameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

async function archiveCorruptFile(relativePath: string): Promise<void> {
  const dir = parentDirOf(relativePath);
  const base = baseFileNameOf(relativePath).replace(/\.json$/i, "");
  const corruptName = `${dir}/${base}.corrupt.${Date.now()}.json`;
  await rename(relativePath, corruptName, { oldPathBaseDir: BD, newPathBaseDir: BD });
}

export function getInventoryFilePath(fileName: string): string {
  return `${INVENTORY_DIR}/${fileName}`;
}

export async function writeInventoryPayload<T>(
  relativePath: string,
  records: T[],
): Promise<void> {
  if (!shouldUseTauriPluginFs()) {
    if (!saveInventoryPayloadToLocalStorage(relativePath, records)) {
      throw new Error(
        "Inventory data could not be saved: browser storage is unavailable or full. Run the app with Tauri (desktop) for file-based persistence, or free local storage space.",
      );
    }
    return;
  }

  const dir = parentDirOf(relativePath);
  if (dir) await mkdir(dir, { recursive: true, baseDir: BD });

  const tmpPath = `${relativePath}.tmp`;
  const payload: Envelope<T> = { version: PERSIST_VERSION, records };
  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  await writeFile(tmpPath, bytes, { baseDir: BD });

  const mainExists = await exists(relativePath, { baseDir: BD });
  if (mainExists) {
    await remove(relativePath, { baseDir: BD });
  }
  await rename(tmpPath, relativePath, { oldPathBaseDir: BD, newPathBaseDir: BD });
  saveInventoryPayloadToLocalStorage(relativePath, records);
}

type LoadOptions<T> = {
  relativePath: string;
  buildSeedRecords: () => T[];
  normalizeRecord: (raw: unknown) => T | null;
  diagnosticsTag: string;
};

export type LoadInventoryResult<T> = {
  records: T[];
  diagnostics: string | null;
};

export async function loadInventoryPersisted<T>(
  options: LoadOptions<T>,
): Promise<LoadInventoryResult<T>> {
  const { relativePath, buildSeedRecords, normalizeRecord, diagnosticsTag } = options;
  const canUseLocalStorage = probeLocalStorageWritable();
  const localStorageRecords = canUseLocalStorage
    ? loadInventoryPayloadFromLocalStorage(relativePath, normalizeRecord)
    : null;

  if (!shouldUseTauriPluginFs()) {
    if (localStorageRecords) {
      return { records: localStorageRecords, diagnostics: null };
    }
    const seed = buildSeedRecords();
    if (saveInventoryPayloadToLocalStorage(relativePath, seed)) {
      return { records: seed, diagnostics: null };
    }
    return {
      records: seed,
      diagnostics: `[${diagnosticsTag}] Browser local storage is not available for inventory data.`,
    };
  }

  try {
    await mkdir(INVENTORY_DIR, { recursive: true, baseDir: BD });

    const fileExists = await exists(relativePath, { baseDir: BD });
    if (!fileExists) {
      if (localStorageRecords) {
        return { records: localStorageRecords, diagnostics: null };
      }
      const seed = buildSeedRecords();
      try {
        await writeInventoryPayload(relativePath, seed);
        return { records: seed, diagnostics: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          diagnostics: `[${diagnosticsTag}] First-run persist failed (using in-memory seed): ${msg}`,
        };
      }
    }

    const bytes = await readFile(relativePath, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const rec = parsed as Partial<Envelope<unknown>> | null;
    const recordsRaw = rec?.records;
    const shapeValid =
      rec != null &&
      typeof rec === "object" &&
      rec.version === PERSIST_VERSION &&
      Array.isArray(recordsRaw);

    if (!shapeValid) {
      try {
        await archiveCorruptFile(relativePath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const seed = buildSeedRecords();
        return {
          records: seed,
          diagnostics: `[${diagnosticsTag}] Could not archive malformed file: ${msg}`,
        };
      }
      const seed = buildSeedRecords();
      try {
        await writeInventoryPayload(relativePath, seed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          diagnostics: `[${diagnosticsTag}] Re-seed write failed: ${msg}`,
        };
      }
      return {
        records: seed,
        diagnostics: `[${diagnosticsTag}] Malformed file detected; archived and re-seeded.`,
      };
    }

    const normalized = recordsRaw
      .map(normalizeRecord)
      .filter((x): x is T => x !== null);
    if (normalized.length === 0 && recordsRaw.length > 0) {
      try {
        await archiveCorruptFile(relativePath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const seed = buildSeedRecords();
        return {
          records: seed,
          diagnostics: `[${diagnosticsTag}] Could not archive invalid records file: ${msg}`,
        };
      }
      const seed = buildSeedRecords();
      try {
        await writeInventoryPayload(relativePath, seed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          diagnostics: `[${diagnosticsTag}] Re-seed write failed: ${msg}`,
        };
      }
      return {
        records: seed,
        diagnostics: `[${diagnosticsTag}] Invalid records detected; archived and re-seeded.`,
      };
    }

    saveInventoryPayloadToLocalStorage(relativePath, normalized);
    return { records: normalized, diagnostics: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (localStorageRecords) {
      return {
        records: localStorageRecords,
        diagnostics: `[${diagnosticsTag}] File load failed; using browser local fallback: ${msg}`,
      };
    }
    const seed = buildSeedRecords();
    saveInventoryPayloadToLocalStorage(relativePath, seed);
    return {
      records: seed,
      diagnostics: `[${diagnosticsTag}] Load failed (using in-memory seed): ${msg}`,
    };
  }
}
