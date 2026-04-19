/**
 * JSON persistence: AppLocalData items/marking-provider-settings.json
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
import type { MarkingProviderSettings } from "../model/markingProviderSettings";
import { normalizeMarkingProviderSettings } from "./normalizeMarkingProviderSettings";

const BD = BaseDirectory.AppLocalData;
const RELATIVE_PATH = "items/marking-provider-settings.json";
const TMP_PATH = "items/marking-provider-settings.json.tmp";

export const MARKING_PROVIDER_SETTINGS_PERSIST_VERSION = 1 as const;

type Envelope = {
  version: typeof MARKING_PROVIDER_SETTINGS_PERSIST_VERSION;
  settings: MarkingProviderSettings;
};

const LS_PREFIX = "mini-erp-marking-provider-settings-v1:";
const LS_PROBE = "__mini_erp_marking_provider_settings_probe__";

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

function parseEnvelopeText(text: string): MarkingProviderSettings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const rec = parsed as Partial<Envelope> | null;
  if (rec == null || typeof rec !== "object" || rec.version !== MARKING_PROVIDER_SETTINGS_PERSIST_VERSION) return null;
  return normalizeMarkingProviderSettings(rec.settings);
}

function loadFromLocalStorage(): MarkingProviderSettings | null {
  try {
    const text = localStorage.getItem(localStorageKey());
    if (!text) return null;
    return parseEnvelopeText(text);
  } catch {
    return null;
  }
}

function saveToLocalStorage(settings: MarkingProviderSettings): boolean {
  try {
    const payload: Envelope = { version: MARKING_PROVIDER_SETTINGS_PERSIST_VERSION, settings };
    localStorage.setItem(localStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function writeMarkingProviderSettingsPayload(settings: MarkingProviderSettings): Promise<void> {
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const payload: Envelope = { version: MARKING_PROVIDER_SETTINGS_PERSIST_VERSION, settings };
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    await writeFile(TMP_PATH, bytes, { baseDir: BD });
    const mainExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (mainExists) {
      await remove(RELATIVE_PATH, { baseDir: BD });
    }
    await rename(TMP_PATH, RELATIVE_PATH, { oldPathBaseDir: BD, newPathBaseDir: BD });
    saveToLocalStorage(settings);
  } catch (e) {
    if (saveToLocalStorage(settings)) return;
    throw e;
  }
}

export type LoadMarkingProviderSettingsResult = {
  settings: MarkingProviderSettings;
  diagnostics: string | null;
};

export async function loadMarkingProviderSettingsPersisted(): Promise<LoadMarkingProviderSettingsResult> {
  const canLs = probeLocalStorageWritable();
  const fromLs = canLs ? loadFromLocalStorage() : null;
  try {
    await mkdir("items", { recursive: true, baseDir: BD });
    const fileExists = await exists(RELATIVE_PATH, { baseDir: BD });
    if (!fileExists) {
      if (fromLs) return { settings: fromLs, diagnostics: null };
      return { settings: normalizeMarkingProviderSettings(null), diagnostics: null };
    }
    const bytes = await readFile(RELATIVE_PATH, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    const parsed = parseEnvelopeText(text);
    if (!parsed) {
      return {
        settings: fromLs ?? normalizeMarkingProviderSettings(null),
        diagnostics: "[markingProviderSettings] Invalid file; using defaults or local fallback.",
      };
    }
    saveToLocalStorage(parsed);
    return { settings: parsed, diagnostics: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fromLs) {
      return { settings: fromLs, diagnostics: `[markingProviderSettings] File load failed; localStorage: ${msg}` };
    }
    return { settings: normalizeMarkingProviderSettings(null), diagnostics: `[markingProviderSettings] Load failed: ${msg}` };
  }
}
