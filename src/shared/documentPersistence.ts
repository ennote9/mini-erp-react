import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";

const BD = BaseDirectory.AppLocalData;
const DOCUMENTS_DIR = "documents";
const PERSIST_VERSION = 1 as const;
const DOCUMENTS_LS_PREFIX = "mini-erp-documents-v1:";
const DOCUMENTS_LS_PROBE_KEY = "__mini_erp_documents_ls_probe__";

type Envelope<T> = {
  version: number;
  records: T[];
};

function localStorageKey(relativePath: string): string {
  return `${DOCUMENTS_LS_PREFIX}${relativePath}`;
}

function probeLocalStorageWritable(): boolean {
  try {
    localStorage.setItem(DOCUMENTS_LS_PROBE_KEY, "1");
    localStorage.removeItem(DOCUMENTS_LS_PROBE_KEY);
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

function loadDocumentPayloadFromLocalStorage<T>(
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

function saveDocumentPayloadToLocalStorage<T>(relativePath: string, records: T[]): boolean {
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

export function getDocumentsFilePath(fileName: string): string {
  return `${DOCUMENTS_DIR}/${fileName}`;
}

export async function writeDocumentPayload<T>(
  relativePath: string,
  records: T[],
): Promise<void> {
  try {
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
    saveDocumentPayloadToLocalStorage(relativePath, records);
    return;
  } catch (error) {
    if (saveDocumentPayloadToLocalStorage(relativePath, records)) return;
    throw error;
  }
}

type LoadOptions<T> = {
  relativePath: string;
  buildSeedRecords: () => T[];
  normalizeRecord: (raw: unknown) => T | null;
  diagnosticsTag: string;
};

export type LoadDocumentResult<T> = {
  records: T[];
  diagnostics: string | null;
};

export async function loadDocumentsPersisted<T>(
  options: LoadOptions<T>,
): Promise<LoadDocumentResult<T>> {
  const { relativePath, buildSeedRecords, normalizeRecord, diagnosticsTag } = options;
  const canUseLocalStorage = probeLocalStorageWritable();
  const localStorageRecords = canUseLocalStorage
    ? loadDocumentPayloadFromLocalStorage(relativePath, normalizeRecord)
    : null;
  try {
    await mkdir(DOCUMENTS_DIR, { recursive: true, baseDir: BD });

    const fileExists = await exists(relativePath, { baseDir: BD });
    if (!fileExists) {
      if (localStorageRecords) {
        return { records: localStorageRecords, diagnostics: null };
      }
      const seed = buildSeedRecords();
      try {
        await writeDocumentPayload(relativePath, seed);
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
        await writeDocumentPayload(relativePath, seed);
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
        await writeDocumentPayload(relativePath, seed);
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
    saveDocumentPayloadToLocalStorage(relativePath, normalized);
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
    saveDocumentPayloadToLocalStorage(relativePath, seed);
    return {
      records: seed,
      diagnostics: `[${diagnosticsTag}] Load failed (using in-memory seed): ${msg}`,
    };
  }
}
