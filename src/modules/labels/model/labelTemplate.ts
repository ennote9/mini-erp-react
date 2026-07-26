import type { LabelElement } from "./labelElement";

export type LabelTemplateKind =
  | "ITEM_LABEL"
  | "PRICE_TAG"
  | "QR_LABEL"
  | "TRANSLATION_STICKER"
  | "DATAMATRIX_LABEL"
  | "CUSTOM";

export type LabelPaperType = "LABEL" | "A4" | "ROLL" | "CUSTOM";

export type LabelSizeMm = {
  width: number;
  height: number;
};

/**
 * Printable label template. System-seeded templates use {@link isSystem}; one may be {@link isDefault}.
 */
export interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  kind: LabelTemplateKind;
  paperType: LabelPaperType;
  sizeMm: LabelSizeMm;
  elements: LabelElement[];
  tags?: string[];
  isActive: boolean;
  /** Preferred template when opening print workspace without a selection. */
  isDefault?: boolean;
  isArchived?: boolean;
  /** Built-in seeded templates; user copies may omit this. */
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}
