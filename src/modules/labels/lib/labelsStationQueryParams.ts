/**
 * Query keys for `/labels/station` — shareable links from item cards or internal navigation.
 */
export const LABELS_STATION_QUERY = {
  itemId: "itemId",
  barcodeId: "barcodeId",
  markingRecordId: "markingRecordId",
  templateId: "templateId",
  copies: "copies",
} as const;

export function buildLabelsStationUrl(params: {
  itemId: string;
  barcodeId?: string;
  markingRecordId?: string;
  templateId?: string;
  copies?: number;
}): string {
  const q = new URLSearchParams();
  q.set(LABELS_STATION_QUERY.itemId, params.itemId);
  if (params.barcodeId) q.set(LABELS_STATION_QUERY.barcodeId, params.barcodeId);
  if (params.markingRecordId) q.set(LABELS_STATION_QUERY.markingRecordId, params.markingRecordId);
  if (params.templateId) q.set(LABELS_STATION_QUERY.templateId, params.templateId);
  if (params.copies != null && params.copies >= 1 && params.copies <= 999) {
    q.set(LABELS_STATION_QUERY.copies, String(params.copies));
  }
  return `/labels/station?${q.toString()}`;
}
