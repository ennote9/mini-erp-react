/**
 * Data binding for label elements — resolves to runtime values at print/preview time (future).
 */

export type LabelBinding =
  | { kind: "field"; path: string }
  | { kind: "selected_barcode" }
  | { kind: "primary_barcode" }
  | { kind: "barcode_by_packaging"; packagingLevel: string }
  | { kind: "barcode_by_role"; role: string }
  | { kind: "selected_marking_payload" }
  | { kind: "selected_marking_human_label" };
