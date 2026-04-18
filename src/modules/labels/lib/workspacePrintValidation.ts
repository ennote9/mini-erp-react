import { labelTemplateRepository } from "../labelTemplateRepository";

export type WorkspacePrintValidationCode =
  | "NO_TEMPLATE"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_ARCHIVED"
  | "COPIES_INVALID";

export function validateWorkspaceForPrintJob(templateId: string | undefined, copies: number): WorkspacePrintValidationCode | null {
  if (!templateId?.trim()) return "NO_TEMPLATE";
  if (!Number.isFinite(copies) || copies < 1 || copies > 999) return "COPIES_INVALID";
  const tpl = labelTemplateRepository.getById(templateId);
  if (!tpl) return "TEMPLATE_NOT_FOUND";
  if (tpl.isArchived) return "TEMPLATE_ARCHIVED";
  return null;
}
