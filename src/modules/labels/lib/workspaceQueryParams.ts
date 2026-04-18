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
} as const;

export function buildLabelsWorkspaceUrl(params: {
  itemId: string;
  barcodeId: string;
  templateId?: string;
  source?: string;
}): string {
  const q = new URLSearchParams();
  q.set(LABELS_WORKSPACE_QUERY.itemId, params.itemId);
  q.set(LABELS_WORKSPACE_QUERY.barcodeId, params.barcodeId);
  if (params.templateId) q.set(LABELS_WORKSPACE_QUERY.templateId, params.templateId);
  if (params.source) q.set(LABELS_WORKSPACE_QUERY.source, params.source);
  return `/labels/workspace?${q.toString()}`;
}
