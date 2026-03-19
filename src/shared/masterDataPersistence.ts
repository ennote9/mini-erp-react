/**
 * Shared JSON persistence for master-data repositories in Tauri AppLocalData.
 * Envelope: { version, records }.
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

const BD = BaseDirectory.AppLocalData;
const MASTER_DATA_DIR = "master-data";
const PERSIST_VERSION = 1 as const;

type Envelope<T> = {
  version: number;
  records: T[];
};

function parentDirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

function baseFileNameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function getMasterDataPersistVersion(): number {
  return PERSIST_VERSION;
}

export function getMasterDataFilePath(fileName: string): string {
  return `${MASTER_DATA_DIR}/${fileName}`;
}

export async function writeMasterDataPayload<T extends { id: string }>(
  relativePath: string,
  records: T[],
): Promise<void> {
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
}

async function archiveCorruptFile(relativePath: string): Promise<void> {
  const dir = parentDirOf(relativePath);
  const base = baseFileNameOf(relativePath).replace(/\.json$/i, "");
  const corruptName = `${dir}/${base}.corrupt.${Date.now()}.json`;
  await rename(relativePath, corruptName, { oldPathBaseDir: BD, newPathBaseDir: BD });
}

type LoadOptions<T extends { id: string }> = {
  relativePath: string;
  buildSeedRecords: () => T[];
  normalizeRecord: (raw: unknown) => T | null;
  diagnosticsTag: string;
};

export type LoadMasterDataResult<T extends { id: string }> = {
  records: T[];
  nextId: number;
  diagnostics: string | null;
};

export async function loadMasterDataPersisted<T extends { id: string }>(
  options: LoadOptions<T>,
): Promise<LoadMasterDataResult<T>> {
  const { relativePath, buildSeedRecords, normalizeRecord, diagnosticsTag } = options;

  try {
    await mkdir(MASTER_DATA_DIR, { recursive: true, baseDir: BD });

    const fileExists = await exists(relativePath, { baseDir: BD });
    if (!fileExists) {
      const seed = buildSeedRecords();
      try {
        await writeMasterDataPayload(relativePath, seed);
        return { records: seed, nextId: computeNextNumericId(seed), diagnostics: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          nextId: computeNextNumericId(seed),
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
          nextId: computeNextNumericId(seed),
          diagnostics: `[${diagnosticsTag}] Could not archive malformed file: ${msg}`,
        };
      }
      const seed = buildSeedRecords();
      try {
        await writeMasterDataPayload(relativePath, seed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          nextId: computeNextNumericId(seed),
          diagnostics: `[${diagnosticsTag}] Re-seed write failed: ${msg}`,
        };
      }
      return {
        records: seed,
        nextId: computeNextNumericId(seed),
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
          nextId: computeNextNumericId(seed),
          diagnostics: `[${diagnosticsTag}] Could not archive invalid records file: ${msg}`,
        };
      }
      const seed = buildSeedRecords();
      try {
        await writeMasterDataPayload(relativePath, seed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          records: seed,
          nextId: computeNextNumericId(seed),
          diagnostics: `[${diagnosticsTag}] Re-seed write failed: ${msg}`,
        };
      }
      return {
        records: seed,
        nextId: computeNextNumericId(seed),
        diagnostics: `[${diagnosticsTag}] Invalid records detected; archived and re-seeded.`,
      };
    }

    return {
      records: normalized,
      nextId: computeNextNumericId(normalized),
      diagnostics: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const seed = buildSeedRecords();
    return {
      records: seed,
      nextId: computeNextNumericId(seed),
      diagnostics: `[${diagnosticsTag}] Load failed (using in-memory seed): ${msg}`,
    };
  }
}
