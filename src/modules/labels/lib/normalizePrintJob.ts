import type { PrintJob, PrintJobMode, PrintJobStatus } from "../model";

const MODES = new Set<PrintJobMode>(["preview", "print", "pdf"]);
const STATUSES = new Set<PrintJobStatus>(["draft", "queued", "submitted", "completed", "failed"]);

function optString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function optBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function optPositiveInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 1 && v === Math.floor(v) ? v : undefined;
}

export function normalizePrintJob(raw: unknown): PrintJob | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const templateId = typeof o.templateId === "string" ? o.templateId : null;
  const copies = typeof o.copies === "number" && Number.isFinite(o.copies) && o.copies >= 1 ? o.copies : null;
  const mode = o.mode;
  const status = o.status;
  if (!id || !templateId || copies === null) return null;
  if (typeof mode !== "string" || !MODES.has(mode as PrintJobMode)) return null;
  if (typeof status !== "string" || !STATUSES.has(status as PrintJobStatus)) return null;

  const itemIdsRaw = o.itemIds;
  const itemIds = Array.isArray(itemIdsRaw)
    ? itemIdsRaw.filter((x): x is string => typeof x === "string")
    : [];

  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  return {
    id,
    templateId,
    templateNameSnapshot: optString(o.templateNameSnapshot),
    itemIds,
    barcodeId: optString(o.barcodeId),
    copies,
    mode: mode as PrintJobMode,
    status: status as PrintJobStatus,
    source: optString(o.source),
    errorMessage: optString(o.errorMessage),
    isDemoContext: optBool(o.isDemoContext),
    itemCodeSnapshot: optString(o.itemCodeSnapshot),
    itemNameSnapshot: optString(o.itemNameSnapshot),
    barcodeValueSnapshot: optString(o.barcodeValueSnapshot),
    paperPreset: optString(o.paperPreset),
    mediaPreset: optString(o.mediaPreset),
    labelSizeMode: o.labelSizeMode === "template" || o.labelSizeMode === "fit" ? o.labelSizeMode : undefined,
    rowsCount: optPositiveInt(o.rowsCount),
    totalLabels: optPositiveInt(o.totalLabels),
    batchSummarySnapshot: optString(o.batchSummarySnapshot),
    batchRowsSnapshot: optString(o.batchRowsSnapshot),
    createdAt,
    updatedAt,
  };
}
