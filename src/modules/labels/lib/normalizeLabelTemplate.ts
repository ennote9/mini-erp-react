import type { LabelPaperType, LabelTemplate, LabelTemplateKind } from "../model";
import { normalizeLabelElement } from "./normalizeLabelElement";

const KINDS = new Set<LabelTemplateKind>([
  "ITEM_LABEL",
  "PRICE_TAG",
  "QR_LABEL",
  "TRANSLATION_STICKER",
  "DATAMATRIX_LABEL",
  "CUSTOM",
]);

const PAPERS = new Set<LabelPaperType>(["LABEL", "A4", "ROLL", "CUSTOM"]);

export function normalizeLabelTemplate(raw: unknown): LabelTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" ? o.name : null;
  const kind = o.kind;
  const paperType = o.paperType;
  if (!id || !name || typeof kind !== "string" || !KINDS.has(kind as LabelTemplateKind)) return null;
  if (typeof paperType !== "string" || !PAPERS.has(paperType as LabelPaperType)) return null;

  const sizeRaw = o.sizeMm;
  if (!sizeRaw || typeof sizeRaw !== "object") return null;
  const sz = sizeRaw as Record<string, unknown>;
  const w = typeof sz.width === "number" && Number.isFinite(sz.width) ? sz.width : null;
  const h = typeof sz.height === "number" && Number.isFinite(sz.height) ? sz.height : null;
  if (w === null || h === null || w <= 0 || h <= 0) return null;

  const elementsRaw = o.elements;
  const elements = Array.isArray(elementsRaw)
    ? elementsRaw.map(normalizeLabelElement).filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const isActive = typeof o.isActive === "boolean" ? o.isActive : true;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string")
    : undefined;

  return {
    id,
    name,
    description: typeof o.description === "string" ? o.description : undefined,
    kind: kind as LabelTemplateKind,
    paperType: paperType as LabelPaperType,
    sizeMm: { width: w, height: h },
    elements,
    tags: tags && tags.length > 0 ? tags : undefined,
    isActive,
    isDefault: typeof o.isDefault === "boolean" ? o.isDefault : undefined,
    isArchived: typeof o.isArchived === "boolean" ? o.isArchived : undefined,
    isSystem: typeof o.isSystem === "boolean" ? o.isSystem : undefined,
    createdAt,
    updatedAt,
  };
}
