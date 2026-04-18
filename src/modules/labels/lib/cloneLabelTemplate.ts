import type { LabelTemplate } from "../model";

export function cloneLabelTemplate(template: LabelTemplate): LabelTemplate {
  return structuredClone(template);
}
