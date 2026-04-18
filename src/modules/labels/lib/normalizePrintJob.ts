import type { PrintJob, PrintJobMode, PrintJobStatus } from "../model";

const MODES = new Set<PrintJobMode>(["preview", "print", "pdf"]);
const STATUSES = new Set<PrintJobStatus>(["draft", "queued", "completed", "failed"]);

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
    itemIds,
    copies,
    mode: mode as PrintJobMode,
    status: status as PrintJobStatus,
    createdAt,
    updatedAt,
  };
}
