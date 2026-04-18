/**
 * High-level SVG generation for label preview / future print pipeline.
 * All bwip-js usage goes through {@link ./bwipAdapter}.
 */
import { bwipToSvg, type BwipRenderOptions } from "./bwipAdapter";
import {
  linearSymbologyToBcid,
  parseLinearSymbologyHint,
  type LabelLinearSymbology,
} from "./labelSymbology";

export type CodeRenderFailureCode = "empty" | "unsupported" | "render";

export type CodeRenderResult =
  | { ok: true; svg: string }
  | { ok: false; code: CodeRenderFailureCode; message: string };

export type RenderBarcodeSvgParams = {
  symbology: LabelLinearSymbology;
  text: string;
  /** Visual scale (bwip-js `scale`). */
  scale?: number;
  includetext?: boolean;
};

/**
 * Linear barcode (CODE_128, EAN-13) → SVG.
 */
export function renderBarcodeSvg(params: RenderBarcodeSvgParams): CodeRenderResult {
  const t = params.text.trim();
  if (!t) {
    return { ok: false, code: "empty", message: "No barcode data" };
  }
  const bcid = linearSymbologyToBcid(params.symbology);
  const scale = params.scale ?? 2;
  const result = bwipToSvg({
    bcid,
    text: t,
    scale,
    includetext: params.includetext ?? false,
  });
  if (!result.ok) {
    return { ok: false, code: "render", message: result.message };
  }
  return { ok: true, svg: result.svg };
}

export type RenderQrSvgParams = {
  text: string;
  scale?: number;
  /** Maps to bwip eclevel when provided. */
  ecLevel?: "L" | "M" | "Q" | "H";
};

/**
 * QR Code → SVG (`bcid`: qrcode).
 */
const QR_EC_TO_BWIP: Record<NonNullable<RenderQrSvgParams["ecLevel"]>, "l" | "m" | "q" | "h"> = {
  L: "l",
  M: "m",
  Q: "q",
  H: "h",
};

export function renderQrSvg(params: RenderQrSvgParams): CodeRenderResult {
  const t = params.text.trim();
  if (!t) {
    return { ok: false, code: "empty", message: "No QR data" };
  }
  const scale = params.scale ?? 3;
  const ec = params.ecLevel ?? "M";
  const opts: BwipRenderOptions = {
    bcid: "qrcode",
    text: t,
    scale,
    eclevel: QR_EC_TO_BWIP[ec],
  };
  const result = bwipToSvg(opts);
  if (!result.ok) {
    return { ok: false, code: "render", message: result.message };
  }
  return { ok: true, svg: result.svg };
}

/**
 * Barcode element: derive symbology from template options and render.
 */
export function renderBarcodeFromElementOptions(params: {
  text: string;
  symbologyHint?: string;
  scale?: number;
  showHumanReadableText?: boolean;
}): CodeRenderResult {
  const parsed = parseLinearSymbologyHint(params.symbologyHint);
  if (parsed === "unsupported") {
    return {
      ok: false,
      code: "unsupported",
      message: `Symbology not supported in this release: ${params.symbologyHint ?? ""}`,
    };
  }
  return renderBarcodeSvg({
    symbology: parsed,
    text: params.text,
    scale: params.scale,
    includetext: params.showHumanReadableText ?? false,
  });
}
