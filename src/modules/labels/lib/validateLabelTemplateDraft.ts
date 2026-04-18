import type { LabelTemplate } from "../model";

/** Stable codes mapped in UI via `labels.editor.validation.*`. */
export type LabelTemplateValidationCode =
  | "nameRequired"
  | "sizeInvalid"
  | "elementGeometry";

/**
 * Lightweight checks before persisting — avoids writing obviously broken geometry.
 */
export function validateLabelTemplateDraft(t: LabelTemplate): LabelTemplateValidationCode[] {
  const errors: LabelTemplateValidationCode[] = [];
  const { width, height } = t.sizeMm;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    errors.push("sizeInvalid");
  }
  if (!t.name.trim()) errors.push("nameRequired");

  const badElement = t.elements.some((el) => {
    if (!Number.isFinite(el.xMm) || !Number.isFinite(el.yMm)) return true;
    if (!Number.isFinite(el.widthMm) || el.widthMm <= 0) return true;
    if (!Number.isFinite(el.heightMm) || el.heightMm <= 0) return true;
    const rot = el.rotation ?? 0;
    if (!Number.isFinite(rot)) return true;
    return false;
  });
  if (badElement) errors.push("elementGeometry");

  return errors;
}
