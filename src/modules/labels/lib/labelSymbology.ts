/**
 * Maps first-release symbology names to bwip-js {@link https://github.com/metafloor/bwip-js} `bcid` values.
 */

export type LabelLinearSymbology = "CODE_128" | "EAN_13";

/** QR is handled separately from linear barcodes (different bwip options). */
export const QR_SYMBOLOGY = "QR" as const;

export type LabelCodeKind = LabelLinearSymbology | typeof QR_SYMBOLOGY;

/** When hint is missing, default to CODE_128 for barcode elements. */
export function linearSymbologyFromHint(symbologyHint?: string): LabelLinearSymbology {
  const parsed = parseLinearSymbologyHint(symbologyHint);
  return parsed === "unsupported" ? "CODE_128" : parsed;
}

export function parseLinearSymbologyHint(symbologyHint?: string): LabelLinearSymbology | "unsupported" {
  if (!symbologyHint?.trim()) return "CODE_128";
  const h = symbologyHint.trim().toUpperCase().replace(/-/g, "_");
  if (h === "EAN_13" || h === "EAN13") return "EAN_13";
  if (h === "CODE_128" || h === "CODE128") return "CODE_128";
  return "unsupported";
}

export function linearSymbologyToBcid(sym: LabelLinearSymbology): "code128" | "ean13" {
  if (sym === "EAN_13") return "ean13";
  return "code128";
}

export function isSupportedLinearSymbologyHint(symbologyHint?: string): boolean {
  return parseLinearSymbologyHint(symbologyHint) !== "unsupported";
}
