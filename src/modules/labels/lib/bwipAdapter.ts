/**
 * Thin wrapper around bwip-js so callers do not import the library directly.
 * Use `bwip-js/browser` so TypeScript resolves the browser entry (Vite + Tauri webview).
 */
import * as BwipJs from "bwip-js/browser";

/** bwip-js `RenderOptions` plus symbol-specific runtime keys (e.g. QR `eclevel`). */
export type BwipRenderOptions = BwipJs.RenderOptions & {
  eclevel?: "l" | "m" | "q" | "h";
};

export type BwipSvgSuccess = { ok: true; svg: string };
export type BwipSvgFailure = { ok: false; message: string };
export type BwipSvgResult = BwipSvgSuccess | BwipSvgFailure;

/**
 * Renders a barcode or QR to an SVG string (browser / Tauri webview).
 */
export function bwipToSvg(opts: BwipRenderOptions): BwipSvgResult {
  try {
    const svg = BwipJs.toSVG(opts);
    if (typeof svg !== "string" || svg.length === 0) {
      return { ok: false, message: "Empty SVG output" };
    }
    return { ok: true, svg };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}
