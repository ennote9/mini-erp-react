import type { LabelBinding } from "../model";

export function normalizeLabelBinding(raw: unknown): LabelBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === "field" && typeof o.path === "string" && o.path.length > 0) {
    return { kind: "field", path: o.path };
  }
  if (kind === "selected_barcode") return { kind: "selected_barcode" };
  if (kind === "primary_barcode") return { kind: "primary_barcode" };
  if (kind === "barcode_by_packaging" && typeof o.packagingLevel === "string") {
    return { kind: "barcode_by_packaging", packagingLevel: o.packagingLevel };
  }
  if (kind === "barcode_by_role" && typeof o.role === "string") {
    return { kind: "barcode_by_role", role: o.role };
  }
  if (kind === "selected_marking_payload") return { kind: "selected_marking_payload" };
  if (kind === "selected_marking_human_label") return { kind: "selected_marking_human_label" };
  return null;
}
