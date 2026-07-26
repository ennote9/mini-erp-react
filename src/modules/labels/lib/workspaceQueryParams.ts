/**
 * Query keys for `/labels/workspace`. Keeps URLs shareable and reload-safe.
 * Future: draft print job, copies override — extend here.
 */
export const LABELS_WORKSPACE_QUERY = {
  itemId: "itemId",
  barcodeId: "barcodeId",
  templateId: "templateId",
  /** e.g. `item-barcodes` when opened from item card tab */
  source: "source",
  /** Restores copy count from a prior operation. */
  copies: "copies",
  /** `1` when opened from operations "reprint" — workspace may show a short hint. */
  reprint: "reprint",
} as const;

export function buildLabelsWorkspaceUrl(params: {
  itemId: string;
  barcodeId: string;
  templateId?: string;
  source?: string;
  copies?: number;
  reprint?: boolean;
}): string {
  const q = new URLSearchParams();
  q.set(LABELS_WORKSPACE_QUERY.itemId, params.itemId);
  q.set(LABELS_WORKSPACE_QUERY.barcodeId, params.barcodeId);
  if (params.templateId) q.set(LABELS_WORKSPACE_QUERY.templateId, params.templateId);
  if (params.source) q.set(LABELS_WORKSPACE_QUERY.source, params.source);
  if (params.copies != null && params.copies >= 1 && params.copies <= 999) {
    q.set(LABELS_WORKSPACE_QUERY.copies, String(params.copies));
  }
  if (params.reprint) q.set(LABELS_WORKSPACE_QUERY.reprint, "1");
  return `/labels/workspace?${q.toString()}`;
}
