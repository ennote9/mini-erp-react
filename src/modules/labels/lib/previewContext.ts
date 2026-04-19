/**
 * Binding preview context for label templates — demo data and real item-backed data share this shape.
 */
import type { LabelBinding } from "../model";

/** Minimal barcode row for binding resolution (no item repository coupling). */
export type LabelPreviewBarcodeRow = {
  codeValue: string;
  packagingLevel: string;
  barcodeRole: string;
  isActive: boolean;
};

/** Dot-paths like `item.name` resolve against this tree. */
export type LabelPreviewBindingContext = {
  item: {
    name: string;
    code: string;
    /** Display string for sale price. */
    salePrice: string;
    purchasePrice?: string;
    brandId?: string;
    categoryId?: string;
    /** Optional: translation sticker / alternate locale line. */
    translationName?: string;
    translationDescription?: string;
    /** Data payload for DataMatrix / GS1 (not legally validated here). */
    markingCode?: string;
    kizCode?: string;
  };
  selectedBarcode: string;
  primaryBarcode: string;
  /** When present, enables `barcode_by_packaging` / `barcode_by_role`. */
  barcodes?: readonly LabelPreviewBarcodeRow[];
};

/** @deprecated Use {@link LabelPreviewBindingContext} */
export type LabelPreviewDemoContext = LabelPreviewBindingContext;

export const LABEL_PREVIEW_DEMO_CONTEXT: LabelPreviewBindingContext = {
  item: {
    name: "Demo brake pad set",
    code: "SKU-DEMO-1042",
    salePrice: "12 500 ₸",
    purchasePrice: "8 900 ₸",
    translationName: "Demo brake pads",
    translationDescription: "Qty 1 kit · aftermarket",
    markingCode: "0105901234123457215ABC123",
    kizCode: "KIZ-DEMO-0001",
  },
  selectedBarcode: "5901234123457",
  primaryBarcode: "5901234123457",
};

function getAtPath(root: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function stringifyResolved(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

/**
 * Resolves a binding to a string for preview. Unsupported / missing data returns `null` (show fallback).
 */
export function resolveLabelBindingValue(
  binding: LabelBinding,
  ctx: LabelPreviewBindingContext,
): string | null {
  switch (binding.kind) {
    case "field": {
      const v = getAtPath(ctx, binding.path);
      return stringifyResolved(v);
    }
    case "selected_barcode":
      return ctx.selectedBarcode.trim() || null;
    case "primary_barcode":
      return ctx.primaryBarcode.trim() || null;
    case "barcode_by_packaging": {
      const rows = ctx.barcodes?.filter((b) => b.isActive && b.packagingLevel === binding.packagingLevel) ?? [];
      const v = rows[0]?.codeValue;
      return v?.trim() || null;
    }
    case "barcode_by_role": {
      const rows = ctx.barcodes?.filter((b) => b.isActive && b.barcodeRole === binding.role) ?? [];
      const v = rows[0]?.codeValue;
      return v?.trim() || null;
    }
    default: {
      const _x: never = binding;
      return _x;
    }
  }
}

export function buildPreviewContext(overrides?: Partial<LabelPreviewBindingContext>): LabelPreviewBindingContext {
  return {
    ...LABEL_PREVIEW_DEMO_CONTEXT,
    ...overrides,
    item: { ...LABEL_PREVIEW_DEMO_CONTEXT.item, ...overrides?.item },
    barcodes: overrides?.barcodes ?? LABEL_PREVIEW_DEMO_CONTEXT.barcodes,
  };
}
