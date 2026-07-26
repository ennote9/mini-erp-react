import { LABELS_BATCH_SOURCE } from "./labelsBatchConstants";

export type BatchRowsSnapshotV1 = {
  v: 1;
  source: typeof LABELS_BATCH_SOURCE;
  templateId: string;
  rows: Array<{ itemId: string; barcodeId?: string; copies: number }>;
};

export type BatchRowsSnapshotV2 = {
  v: 2;
  source: typeof LABELS_BATCH_SOURCE;
  templateId: string;
  rows: Array<{ itemId: string; barcodeId?: string; copies: number }>;
};

export type BatchRowsSnapshot = BatchRowsSnapshotV1 | BatchRowsSnapshotV2;

export function serializeBatchRowsSnapshot(data: {
  templateId: string;
  rows: BatchRowsSnapshotV2["rows"];
}): string {
  const payload: BatchRowsSnapshotV2 = {
    v: 2,
    source: LABELS_BATCH_SOURCE,
    templateId: data.templateId,
    rows: data.rows,
  };
  return JSON.stringify(payload);
}

export function parseBatchRowsSnapshot(raw: string | undefined | null): BatchRowsSnapshotV2 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const x = o as Record<string, unknown>;
    const v = x.v;
    if (v === 2) {
      const templateId = typeof x.templateId === "string" ? x.templateId : null;
      const rowsRaw = x.rows;
      if (!templateId || !Array.isArray(rowsRaw)) return null;
      const rows: BatchRowsSnapshotV2["rows"] = [];
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
      if (x.source !== LABELS_BATCH_SOURCE) return null;
      return { v: 2, source: LABELS_BATCH_SOURCE, templateId, rows };
    }
    if (v === 1) {
      const templateId = typeof x.templateId === "string" ? x.templateId : null;
      const rowsRaw = x.rows;
      if (!templateId || !Array.isArray(rowsRaw)) return null;
      const rows: BatchRowsSnapshotV2["rows"] = [];
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
      if (x.source !== LABELS_BATCH_SOURCE) return null;
      return { v: 2, source: LABELS_BATCH_SOURCE, templateId, rows };
    }
    return null;
  } catch {
    return null;
  }
}
