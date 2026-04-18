import type { LabelElement, LabelShapeKind, LabelTextStyle } from "../model";
import { normalizeLabelBinding } from "./normalizeLabelBinding";

function normalizeBase(raw: Record<string, unknown>): {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation?: number;
} | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const xMm = typeof raw.xMm === "number" && Number.isFinite(raw.xMm) ? raw.xMm : null;
  const yMm = typeof raw.yMm === "number" && Number.isFinite(raw.yMm) ? raw.yMm : null;
  const widthMm = typeof raw.widthMm === "number" && Number.isFinite(raw.widthMm) ? raw.widthMm : null;
  const heightMm = typeof raw.heightMm === "number" && Number.isFinite(raw.heightMm) ? raw.heightMm : null;
  if (!id || xMm === null || yMm === null || widthMm === null || heightMm === null) return null;
  const rotation =
    typeof raw.rotation === "number" && Number.isFinite(raw.rotation) ? raw.rotation : undefined;
  return { id, xMm, yMm, widthMm, heightMm, rotation };
}

function normalizeTextStyle(raw: unknown): LabelTextStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const style: LabelTextStyle = {};
  if (typeof o.fontSizeMm === "number" && Number.isFinite(o.fontSizeMm)) style.fontSizeMm = o.fontSizeMm;
  if (o.fontWeight === "normal" || o.fontWeight === "bold") style.fontWeight = o.fontWeight;
  if (o.textAlign === "left" || o.textAlign === "center" || o.textAlign === "right") {
    style.textAlign = o.textAlign;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

const SHAPE_KINDS = new Set<LabelShapeKind>(["rect", "line", "ellipse"]);

export function normalizeLabelElement(raw: unknown): LabelElement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  const base = normalizeBase(o);
  if (!base) return null;

  if (type === "text") {
    const text = typeof o.text === "string" ? o.text : undefined;
    const bindingRaw = o.binding;
    const bindingLo =
      bindingRaw === undefined ? undefined : normalizeLabelBinding(bindingRaw);
    if (bindingRaw !== undefined && bindingLo === null) return null;
    const binding = bindingLo ?? undefined;
    return {
      ...base,
      type: "text",
      text,
      binding,
      style: normalizeTextStyle(o.style),
    };
  }

  if (type === "barcode") {
    const binding = normalizeLabelBinding(o.binding);
    if (!binding) return null;
    const optRaw = o.options;
    let options: { symbologyHint?: string; showHumanReadableText?: boolean } | undefined;
    if (optRaw && typeof optRaw === "object") {
      const r = optRaw as Record<string, unknown>;
      options = {};
      if (typeof r.symbologyHint === "string") options.symbologyHint = r.symbologyHint;
      if (typeof r.showHumanReadableText === "boolean") options.showHumanReadableText = r.showHumanReadableText;
      if (Object.keys(options).length === 0) options = undefined;
    }
    return {
      ...base,
      type: "barcode",
      binding,
      options,
    };
  }

  if (type === "qr") {
    const binding = normalizeLabelBinding(o.binding);
    if (!binding) return null;
    const optRaw = o.options;
    let options: { errorCorrection?: "L" | "M" | "Q" | "H" } | undefined;
    if (optRaw && typeof optRaw === "object") {
      const ec = (optRaw as Record<string, unknown>).errorCorrection;
      if (ec === "L" || ec === "M" || ec === "Q" || ec === "H") {
        options = { errorCorrection: ec };
      }
    }
    return {
      ...base,
      type: "qr",
      binding,
      options,
    };
  }

  if (type === "image") {
    const bindingRaw = o.binding;
    const bindingLo =
      bindingRaw === undefined ? undefined : normalizeLabelBinding(bindingRaw);
    if (bindingRaw !== undefined && bindingLo === null) return null;
    const binding = bindingLo ?? undefined;
    const src = typeof o.src === "string" ? o.src : undefined;
    const fit =
      o.fit === "contain" || o.fit === "cover" || o.fit === "fill" ? o.fit : undefined;
    return {
      ...base,
      type: "image",
      binding,
      src,
      fit,
    };
  }

  if (type === "shape") {
    const shapeKind = o.shapeKind;
    if (typeof shapeKind !== "string" || !SHAPE_KINDS.has(shapeKind as LabelShapeKind)) return null;
    return {
      ...base,
      type: "shape",
      shapeKind: shapeKind as LabelShapeKind,
      style:
        o.style && typeof o.style === "object"
          ? (o.style as { strokeMm?: number; fill?: string; stroke?: string })
          : undefined,
    };
  }

  return null;
}
