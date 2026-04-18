import type { LabelTemplate, PrintJob } from "./model";
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
    templateId: input.templateId,
    itemIds: input.itemIds,
    copies: input.copies,
    mode: input.mode ?? "preview",
    status: "draft",
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
