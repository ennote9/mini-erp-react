/**
 * Local persistence for last-used workspace print options (MVP presets).
 * Not synced to server — foundation for future sticker department profiles.
 */
const STORAGE_KEY = "mini-erp.labels.workspacePrintSettings.v1";

export type LabelWorkspacePrintSettings = {
  copies: number;
  /** Paper/stock hint (aligns with template paper types + AUTO). */
  paperPreset: string;
  /** Media path hint for future driver integration. */
  mediaPreset: string;
  labelSizeMode: "template" | "fit";
  lastUsedAt: string;
};

const DEFAULTS: LabelWorkspacePrintSettings = {
  copies: 1,
  paperPreset: "AUTO",
  mediaPreset: "DEFAULT",
  labelSizeMode: "template",
  lastUsedAt: new Date(0).toISOString(),
};

export function loadWorkspacePrintSettings(): LabelWorkspacePrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw) as Partial<LabelWorkspacePrintSettings>;
    const copies =
      typeof o.copies === "number" && Number.isFinite(o.copies) && o.copies >= 1 && o.copies <= 999
        ? o.copies
        : DEFAULTS.copies;
    return {
      copies,
      paperPreset: typeof o.paperPreset === "string" ? o.paperPreset : DEFAULTS.paperPreset,
      mediaPreset: typeof o.mediaPreset === "string" ? o.mediaPreset : DEFAULTS.mediaPreset,
      labelSizeMode: o.labelSizeMode === "fit" ? "fit" : "template",
      lastUsedAt: typeof o.lastUsedAt === "string" ? o.lastUsedAt : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveWorkspacePrintSettings(partial: Partial<LabelWorkspacePrintSettings>): void {
  const prev = loadWorkspacePrintSettings();
  const next: LabelWorkspacePrintSettings = {
    ...prev,
    ...partial,
    lastUsedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
