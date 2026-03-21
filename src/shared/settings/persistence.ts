/**
 * Local JSON persistence for app settings under Tauri AppLocalData.
 * Mirrors items/documents style: versioned envelope, temp write, corrupt archive, safe fallback.
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
import { DEFAULT_APP_SETTINGS } from "./defaults";
import { normalizeAppSettingsFromUnknown } from "./mergeNormalize";
import type { AppSettings } from "./types";
import type { SettingsPersistenceState } from "./persistenceState";

const BD = BaseDirectory.AppLocalData;
const CONFIG_DIR = "config";
const SETTINGS_RELATIVE = "config/app-settings.json";
const SETTINGS_TMP = "config/app-settings.json.tmp";

export const APP_SETTINGS_FILE_VERSION = 1 as const;

type PersistEnvelope = {
  version: typeof APP_SETTINGS_FILE_VERSION;
  settings: AppSettings;
};

const LS_KEY = "mini-erp-app-settings-v1";
const LS_PROBE_KEY = "__mini_erp_settings_ls_probe__";

export type AppSettingsLoadResult = {
  settings: AppSettings;
  persistenceState: SettingsPersistenceState;
  /** Corrupt main file was replaced (optional subtle copy). */
  corruptRestored: boolean;
  /** Raw error for dev console / expandable details only — not for primary UI. */
  lastFilesystemError: string | null;
};

function parentDirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

async function archiveCorruptSettings(): Promise<void> {
  const corruptName = `config/app-settings.corrupt.${Date.now()}.json`;
  await rename(SETTINGS_RELATIVE, corruptName, { oldPathBaseDir: BD, newPathBaseDir: BD });
}

function parseEnvelope(text: string): AppSettings | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  if (rec.version !== APP_SETTINGS_FILE_VERSION) return null;
  if (!rec.settings || typeof rec.settings !== "object") return null;
  return normalizeAppSettingsFromUnknown(rec.settings);
}

function loadFromLocalStorage(): AppSettings | null {
  try {
    const text = localStorage.getItem(LS_KEY);
    if (!text) return null;
    return parseEnvelope(text);
  } catch {
    return null;
  }
}

/** Returns true if localStorage can be used for read/write. */
export function probeLocalStorageWritable(): boolean {
  try {
    localStorage.setItem(LS_PROBE_KEY, "1");
    localStorage.removeItem(LS_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function saveToLocalStorage(settings: AppSettings): boolean {
  try {
    const env: PersistEnvelope = { version: APP_SETTINGS_FILE_VERSION, settings };
    localStorage.setItem(LS_KEY, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

function fsErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function tryWriteFile(settings: AppSettings): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const normalized = normalizeAppSettingsFromUnknown(settings);
  const payload: PersistEnvelope = {
    version: APP_SETTINGS_FILE_VERSION,
    settings: normalized,
  };
  const json = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(json);

  try {
    const dir = parentDirOf(SETTINGS_RELATIVE);
    if (dir) await mkdir(dir, { recursive: true, baseDir: BD });
    await writeFile(SETTINGS_TMP, bytes, { baseDir: BD });
    const mainExists = await exists(SETTINGS_RELATIVE, { baseDir: BD });
    if (mainExists) {
      await remove(SETTINGS_RELATIVE, { baseDir: BD });
    }
    await rename(SETTINGS_TMP, SETTINGS_RELATIVE, { oldPathBaseDir: BD, newPathBaseDir: BD });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: fsErrorMessage(e) };
  }
}

/**
 * Persist settings: prefer file; on failure use localStorage. Never throws.
 * Returns the effective persistence mode after the attempt.
 */
export async function persistAppSettings(settings: AppSettings): Promise<SettingsPersistenceState> {
  const fileResult = await tryWriteFile(settings);
  if (fileResult.ok) {
    saveToLocalStorage(normalizeAppSettingsFromUnknown(settings));
    return "file_persisted";
  }
  const lsOk = saveToLocalStorage(normalizeAppSettingsFromUnknown(settings));
  if (import.meta.env.DEV) {
    console.warn("[settingsPersistence] File write failed; using localStorage if available.", fileResult.error);
  }
  if (lsOk) return "fallback_persisted";
  if (import.meta.env.DEV) {
    console.error("[settingsPersistence] localStorage save also failed.");
  }
  return "defaults_only";
}

/**
 * Load settings from disk, then localStorage, then defaults.
 * Does not throw; returns persistenceState for UX.
 */
export async function loadAppSettingsFromDisk(): Promise<AppSettingsLoadResult> {
  const lsReadable = probeLocalStorageWritable();

  try {
    await mkdir(CONFIG_DIR, { recursive: true, baseDir: BD });
    const fileExists = await exists(SETTINGS_RELATIVE, { baseDir: BD });

    if (!fileExists) {
      const fromLs = loadFromLocalStorage();
      if (fromLs) {
        return {
          settings: fromLs,
          persistenceState: "fallback_persisted",
          corruptRestored: false,
          lastFilesystemError: null,
        };
      }
      return {
        settings: structuredClone(DEFAULT_APP_SETTINGS),
        persistenceState: "file_persisted",
        corruptRestored: false,
        lastFilesystemError: null,
      };
    }

    const bytes = await readFile(SETTINGS_RELATIVE, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    const parsed = parseEnvelope(text);
    if (!parsed) {
      let fsErr: string | null = null;
      try {
        await archiveCorruptSettings();
      } catch {
        /* ignore */
      }
      const fallback = structuredClone(DEFAULT_APP_SETTINGS);
      const mode = await persistAppSettings(fallback);
      if (mode === "defaults_only") {
        fsErr = "Could not write recovered defaults.";
      }
      return {
        settings: fallback,
        persistenceState: mode,
        corruptRestored: true,
        lastFilesystemError: fsErr,
      };
    }

    return {
      settings: parsed,
      persistenceState: "file_persisted",
      corruptRestored: false,
      lastFilesystemError: null,
    };
  } catch (e) {
    const errMsg = fsErrorMessage(e);
    if (import.meta.env.DEV) {
      console.warn("[settingsPersistence] App data file path unavailable.", errMsg);
    }

    const fromLs = loadFromLocalStorage();
    if (fromLs) {
      return {
        settings: fromLs,
        persistenceState: "fallback_persisted",
        corruptRestored: false,
        lastFilesystemError: null,
      };
    }

    if (lsReadable) {
      return {
        settings: structuredClone(DEFAULT_APP_SETTINGS),
        persistenceState: "fallback_persisted",
        corruptRestored: false,
        lastFilesystemError: null,
      };
    }

    return {
      settings: structuredClone(DEFAULT_APP_SETTINGS),
      persistenceState: "defaults_only",
      corruptRestored: false,
      lastFilesystemError: errMsg,
    };
  }
}

/** @deprecated Use persistAppSettings — kept for direct callers; wraps new API. */
export async function writeAppSettingsToDisk(settings: AppSettings): Promise<void> {
  await persistAppSettings(settings);
}
