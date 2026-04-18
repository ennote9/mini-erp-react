import { LABELS_BATCH_SOURCE } from "./labelsBatchConstants";

export type BatchRowsSnapshotV1 = {
  v: 1;
  source: typeof LABELS_BATCH_SOURCE;
  templateId: string;
  rows: Array<{ itemId: string; barcodeId?: string; copies: number }>;
};

export function serializeBatchRowsSnapshot(data: Omit<BatchRowsSnapshotV1, "v" | "source">): string {
  const payload: BatchRowsSnapshotV1 = {
    v: 1,
    source: LABELS_BATCH_SOURCE,
    templateId: data.templateId,
    rows: data.rows,
  };
  return JSON.stringify(payload);
}

export function parseBatchRowsSnapshot(raw: string | undefined | null): BatchRowsSnapshotV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const x = o as Record<string, unknown>;
    if (x.v !== 1) return null;
    if (x.source !== LABELS_BATCH_SOURCE) return null;
    const templateId = typeof x.templateId === "string" ? x.templateId : null;
    const rowsRaw = x.rows;
    if (!templateId || !Array.isArray(rowsRaw)) return null;
    const rows: BatchRowsSnapshotV1["rows"] = [];
    for (const r of rowsRaw) {
      if (!r || typeof r !== "object") continue;
      const rr = r as Record<string, unknown>;
      const itemId = typeof rr.itemId === "string" ? rr.itemId : null;
      const copies = typeof rr.copies === "number" && Number.isFinite(rr.copies) ? rr.copies : NaN;
      if (!itemId || copies < 1 || copies > 999) continue;
      rows.push({
        itemId,
        barcodeId: typeof rr.barcodeId === "string" ? rr.barcodeId : undefined,
        copies: Math.floor(copies),
      });
    }
    if (rows.length === 0) return null;
    return { v: 1, source: LABELS_BATCH_SOURCE, templateId, rows };
  } catch {
    return null;
  }
}
