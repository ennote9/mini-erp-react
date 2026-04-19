import type { LabelTemplate, PrintJob, PrintJobMode, PrintJobStatus } from "./model";
import { LABELS_BATCH_SOURCE } from "./lib/labelsBatchConstants";
import { LABELS_STATION_SOURCE } from "./lib/labelsStationConstants";
import {
  flushPendingLabelTemplatePersist,
  labelTemplateRepository,
} from "./labelTemplateRepository";
import {
  flushPendingPrintJobPersist,
  printJobRepository,
  type CreatePrintJobInput,
} from "./printJobRepository";

/**
 * Facade for pages: list templates, default selection, draft print jobs.
 * Repositories self-bootstrap on import; this module adds domain-oriented helpers.
 */

export function listLabelTemplatesForDisplay(): LabelTemplate[] {
  return labelTemplateRepository
    .list()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function listActiveLabelTemplates(): LabelTemplate[] {
  return listLabelTemplatesForDisplay().filter((t) => t.isActive !== false && !t.isArchived);
}

export function getDefaultLabelTemplate(): LabelTemplate | undefined {
  const active = listActiveLabelTemplates();
  const def = active.find((t) => t.isDefault === true);
  if (def) return def;
  return active[0];
}

export function createDraftPrintJob(
  input: Omit<CreatePrintJobInput, "status" | "mode"> & {
    mode?: CreatePrintJobInput["mode"];
  },
): PrintJob {
  return printJobRepository.create({
    ...input,
    mode: input.mode ?? "preview",
    status: "draft",
  });
}

export function listPrintJobsForDisplay(): PrintJob[] {
  return printJobRepository
    .list()
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isRepeatableCatalogJob(j: PrintJob): boolean {
  if (j.isDemoContext) return false;
  if (j.mode !== "print" && j.mode !== "pdf") return false;
  return j.itemIds.length > 0;
}

/**
 * Latest job suitable for “repeat last” on the sticker station: prefers {@link LABELS_STATION_SOURCE}, else any catalog print/PDF.
 */
export function getLastLabelsStationRepeatableJob(): PrintJob | undefined {
  const jobs = listPrintJobsForDisplay();
  const fromStation = jobs.find(
    (j) => isRepeatableCatalogJob(j) && j.source === LABELS_STATION_SOURCE,
  );
  if (fromStation) return fromStation;
  return jobs.find((j) => isRepeatableCatalogJob(j));
}

/** Latest batch print/PDF job for restoring `/labels/batch`. */
export function getLastLabelsBatchRepeatableJob(): PrintJob | undefined {
  return listPrintJobsForDisplay().find(
    (j) =>
      !j.isDemoContext &&
      (j.mode === "print" || j.mode === "pdf") &&
      j.source === LABELS_BATCH_SOURCE &&
      j.batchRowsSnapshot,
  );
}

export type CreateBatchPrintJobInput = {
  templateId: string;
  copies: number;
  mode: PrintJobMode;
  status?: PrintJobStatus;
  itemIds: string[];
  isDemoContext: boolean;
  itemNameSnapshot?: string;
  itemCodeSnapshot?: string;
  barcodeValueSnapshot?: string;
  errorMessage?: string;
  paperPreset?: string;
  mediaPreset?: string;
  labelSizeMode?: "template" | "fit";
  rowsCount: number;
  totalLabels: number;
  batchSummarySnapshot?: string;
  batchRowsSnapshot?: string;
};

/** Single persisted job for a whole batch (not per line). */
export function createPrintJobFromBatch(input: CreateBatchPrintJobInput): PrintJob {
  const tpl = labelTemplateRepository.getById(input.templateId);
  if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");
  const payload: CreatePrintJobInput = {
    templateId: input.templateId,
    templateNameSnapshot: tpl.name,
    templateKindSnapshot: tpl.kind,
    itemIds: input.itemIds,
    copies: input.copies,
    mode: input.mode,
    status: input.status ?? "draft",
    source: LABELS_BATCH_SOURCE,
    isDemoContext: input.isDemoContext,
    itemNameSnapshot: input.itemNameSnapshot,
    itemCodeSnapshot: input.itemCodeSnapshot,
    barcodeValueSnapshot: input.barcodeValueSnapshot,
    errorMessage: input.errorMessage,
    paperPreset: input.paperPreset,
    mediaPreset: input.mediaPreset,
    labelSizeMode: input.labelSizeMode,
    rowsCount: input.rowsCount,
    totalLabels: input.totalLabels,
    batchSummarySnapshot: input.batchSummarySnapshot,
    batchRowsSnapshot: input.batchRowsSnapshot,
  };
  return printJobRepository.create(payload);
}

export type CreateWorkspacePrintJobInput = {
  templateId: string;
  copies: number;
  mode: PrintJobMode;
  status?: PrintJobStatus;
  itemIds: string[];
  barcodeId?: string;
  source?: string | null;
  isDemoContext: boolean;
  itemNameSnapshot?: string;
  itemCodeSnapshot?: string;
  barcodeValueSnapshot?: string;
  errorMessage?: string;
  paperPreset?: string;
  mediaPreset?: string;
  labelSizeMode?: "template" | "fit";
};

/** Creates a persisted job from workspace context; fills template name snapshot from the repository. */
export function createPrintJobFromWorkspace(input: CreateWorkspacePrintJobInput): PrintJob {
  const tpl = labelTemplateRepository.getById(input.templateId);
  if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");
  const payload: CreatePrintJobInput = {
    templateId: input.templateId,
    templateNameSnapshot: tpl.name,
    templateKindSnapshot: tpl.kind,
    itemIds: input.itemIds,
    barcodeId: input.barcodeId,
    copies: input.copies,
    mode: input.mode,
    status: input.status ?? "draft",
    source: input.source ?? undefined,
    isDemoContext: input.isDemoContext,
    itemNameSnapshot: input.itemNameSnapshot,
    itemCodeSnapshot: input.itemCodeSnapshot,
    barcodeValueSnapshot: input.barcodeValueSnapshot,
    errorMessage: input.errorMessage,
    paperPreset: input.paperPreset,
    mediaPreset: input.mediaPreset,
    labelSizeMode: input.labelSizeMode,
  };
  return printJobRepository.create(payload);
}

/** After system print dialog closes (`afterprint`); does not prove physical print. */
export function markPrintJobSubmitted(id: string): PrintJob | undefined {
  return printJobRepository.update(id, {
    status: "submitted",
    errorMessage: undefined,
  });
}

export function markPrintJobCompleted(id: string, patch?: Partial<Pick<PrintJob, "mode">>): PrintJob | undefined {
  return printJobRepository.update(id, {
    status: "completed",
    errorMessage: undefined,
    ...patch,
  });
}

export function markPrintJobFailed(id: string, errorMessage: string): PrintJob | undefined {
  return printJobRepository.update(id, {
    status: "failed",
    errorMessage,
  });
}

/** Resolves when module is importable; repositories bootstrap via top-level await on first import. */
export function ensureLabelsModuleLoaded(): Promise<void> {
  return Promise.resolve();
}

export async function flushPendingLabelWrites(): Promise<void> {
  await Promise.all([flushPendingLabelTemplatePersist(), flushPendingPrintJobPersist()]);
}

/** Persists a full template replacement; bumps `updatedAt` and revision. */
export function persistLabelTemplate(template: LabelTemplate): LabelTemplate {
  const next: LabelTemplate = {
    ...template,
    updatedAt: new Date().toISOString(),
  };
  return labelTemplateRepository.save(next);
}
