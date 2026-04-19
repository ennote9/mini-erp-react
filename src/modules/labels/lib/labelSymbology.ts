/**
 * Maps symbology hints to bwip-js {@link https://github.com/metafloor/bwip-js} `bcid` values.
 * Aligns with {@link ItemBarcodeSymbology} naming where possible (EAN_13, CODE_128, …).
 */

export type ParsedLabelSymbology =
  | { ok: true; bcid: string; includetextDefault: boolean }
  | { ok: false; reason: "unsupported" };

/** @deprecated Narrow legacy type; prefer {@link parseLabelSymbologyHint}. */
export type LabelLinearSymbology = "CODE_128" | "EAN_13";

/** QR is handled separately ({@link renderQrSvg}). */
export const QR_SYMBOLOGY = "QR" as const;

export type LabelCodeKind = LabelLinearSymbology | typeof QR_SYMBOLOGY;

const SYM_TABLE: Record<string, { bcid: string; includetextDefault: boolean }> = {
  CODE_128: { bcid: "code128", includetextDefault: false },
  CODE128: { bcid: "code128", includetextDefault: false },
  EAN_13: { bcid: "ean13", includetextDefault: true },
  EAN13: { bcid: "ean13", includetextDefault: true },
  GS1_128: { bcid: "gs1-128", includetextDefault: true },
  GS1128: { bcid: "gs1-128", includetextDefault: true },
  DATAMATRIX: { bcid: "datamatrix", includetextDefault: false },
  DATA_MATRIX: { bcid: "datamatrix", includetextDefault: false },
  GS1_DATAMATRIX: { bcid: "gs1datamatrix", includetextDefault: false },
  GS1DATAMATRIX: { bcid: "gs1datamatrix", includetextDefault: false },
};

export function parseLabelSymbologyHint(symbologyHint?: string): ParsedLabelSymbology {
  if (!symbologyHint?.trim()) {
    return { ok: true, bcid: "code128", includetextDefault: false };
  }
  const h = symbologyHint.trim().toUpperCase().replace(/-/g, "_");
  const hit = SYM_TABLE[h];
  if (hit) return { ok: true, bcid: hit.bcid, includetextDefault: hit.includetextDefault };
  return { ok: false, reason: "unsupported" };
}

/** @deprecated Use {@link parseLabelSymbologyHint}. */
export function parseLinearSymbologyHint(symbologyHint?: string): LabelLinearSymbology | "unsupported" {
  const p = parseLabelSymbologyHint(symbologyHint);
  if (!p.ok) return "unsupported";
  if (p.bcid === "ean13") return "EAN_13";
  return "CODE_128";
}

/** When hint is missing or unknown, default to CODE_128 for legacy callers. */
export function linearSymbologyFromHint(symbologyHint?: string): LabelLinearSymbology {
  const parsed = parseLinearSymbologyHint(symbologyHint);
  return parsed === "unsupported" ? "CODE_128" : parsed;
}

/** @deprecated Use {@link parseLabelSymbologyHint} + bwip `bcid`. */
export function linearSymbologyToBcid(sym: LabelLinearSymbology): "code128" | "ean13" {
  if (sym === "EAN_13") return "ean13";
  return "code128";
}

export function isSupportedLinearSymbologyHint(symbologyHint?: string): boolean {
  return parseLabelSymbologyHint(symbologyHint).ok;
}

export function isMatrixBcid(bcid: string): boolean {
  return bcid === "datamatrix" || bcid === "gs1datamatrix";
}
