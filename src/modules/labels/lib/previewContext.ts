/**
 * Typed demo data for label preview only. Replace with real item context when integrating item page.
 */
import type { LabelBinding } from "../model";

/** Dot-paths like `item.name` resolve against this tree. */
export type LabelPreviewDemoContext = {
  item: {
    name: string;
    code: string;
    /** Display string for price (already formatted for UI). */
    salePrice: string;
  };
  /** Simulates UI-selected barcode value (e.g. from a picker). */
  selectedBarcode: string;
  /** Simulates item primary unit barcode. */
  primaryBarcode: string;
};

export const LABEL_PREVIEW_DEMO_CONTEXT: LabelPreviewDemoContext = {
  item: {
    name: "Demo brake pad set",
    code: "SKU-DEMO-1042",
    salePrice: "12 500 ₸",
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
 * Resolves a binding to a string for preview. Unsupported kinds return `null` (show fallback).
 */
export function resolveLabelBindingValue(
  binding: LabelBinding,
  ctx: LabelPreviewDemoContext,
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
    case "barcode_by_packaging":
    case "barcode_by_role":
      return null;
    default: {
      const _x: never = binding;
      return _x;
    }
  }
}

/**
 * Optional wrapper for future real contexts; demo is the default for workspace preview.
 */
export function buildPreviewContext(overrides?: Partial<LabelPreviewDemoContext>): LabelPreviewDemoContext {
  return {
    ...LABEL_PREVIEW_DEMO_CONTEXT,
    ...overrides,
    item: { ...LABEL_PREVIEW_DEMO_CONTEXT.item, ...overrides?.item },
  };
}
