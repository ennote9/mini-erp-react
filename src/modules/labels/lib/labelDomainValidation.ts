import type { Item } from "@/modules/items/model";
import type { LabelElement, LabelTemplate } from "../model";
import type { LabelPreviewBindingContext } from "./previewContext";
import { resolveLabelBindingValue } from "./previewContext";
import { buildItemPreviewBindingContext } from "./itemPreviewContext";
import { parseLabelSymbologyHint } from "./labelSymbology";

export type LabelDomainIssueCode =
  | "translationContentMissing"
  | "kizMarkingMissing"
  | "datamatrixSourceMissing"
  | "matrixBindingEmpty";

function hasTranslationDisplayContent(item: LabelPreviewBindingContext["item"]): boolean {
  return [item.translationName, item.translationDescription, item.translationComposition, item.translationExtraText].some(
    (s) => s?.trim(),
  );
}

function hasKizMarkingSource(item: LabelPreviewBindingContext["item"]): boolean {
  return !!(item.kizCode?.trim() || item.markingCode?.trim() || item.gs1DataMatrixPayload?.trim());
}

function hasDatamatrixItemSource(item: LabelPreviewBindingContext["item"]): boolean {
  return !!(
    item.dataMatrixPayload?.trim() ||
    item.gs1DataMatrixPayload?.trim() ||
    item.markingCode?.trim()
  );
}

/**
 * Stable codes for domain checks (no i18n). Use for batch row validation and tests.
 */
export function collectLabelDomainIssueCodes(
  template: LabelTemplate,
  ctx: LabelPreviewBindingContext,
): LabelDomainIssueCode[] {
  const codes: LabelDomainIssueCode[] = [];
  const item = ctx.item;

  if (template.kind === "TRANSLATION_STICKER") {
    if (!hasTranslationDisplayContent(item)) {
      codes.push("translationContentMissing");
    }
  }

  if (template.kind === "KIZ_LABEL") {
    if (!hasKizMarkingSource(item)) {
      codes.push("kizMarkingMissing");
    }
  }

  if (template.kind === "DATAMATRIX_LABEL") {
    if (!hasDatamatrixItemSource(item)) {
      codes.push("datamatrixSourceMissing");
    }
  }

  let anyMatrixBindingEmpty = false;
  for (const el of template.elements) {
    if (el.type !== "barcode") continue;
    const hint = el.options?.symbologyHint;
    const parsed = parseLabelSymbologyHint(hint);
    if (!parsed.ok) continue;
    if (parsed.bcid !== "datamatrix" && parsed.bcid !== "gs1datamatrix") continue;
    const raw = resolveLabelBindingValue(el.binding, ctx);
    if (raw === null || raw.trim() === "") {
      anyMatrixBindingEmpty = true;
    }
  }
  if (anyMatrixBindingEmpty) {
    codes.push("matrixBindingEmpty");
  }

  return [...new Set(codes)];
}

/** True when domain checks fail (print/PDF/job should stay disabled). */
export function areLabelDomainIssuesBlocking(codes: readonly LabelDomainIssueCode[]): boolean {
  return codes.length > 0;
}

/**
 * Pragmatic checks before print/PDF — does not prove regulatory compliance.
 */
export function collectLabelDomainIssues(
  template: LabelTemplate,
  ctx: LabelPreviewBindingContext,
  t: (key: string) => string,
): string[] {
  return collectLabelDomainIssueCodes(template, ctx).map((c) => t(`labels.domainIssues.${c}`));
}

export function labelElementsNeedMatrixPayload(elements: LabelElement[]): boolean {
  return elements.some((el) => {
    if (el.type !== "barcode") return false;
    const p = parseLabelSymbologyHint(el.options?.symbologyHint);
    return p.ok && (p.bcid === "datamatrix" || p.bcid === "gs1datamatrix");
  });
}

export function collectLabelDomainIssueCodesForItem(
  template: LabelTemplate,
  item: Item,
  barcodeId: string | undefined,
  markingRecordId?: string | undefined,
): LabelDomainIssueCode[] {
  const { context } = buildItemPreviewBindingContext(item, { barcodeId, markingRecordId });
  return collectLabelDomainIssueCodes(template, context);
}

export function collectLabelDomainIssuesForItem(
  template: LabelTemplate,
  item: Item,
  barcodeId: string | undefined,
  t: (key: string) => string,
  markingRecordId?: string | undefined,
): string[] {
  return collectLabelDomainIssueCodesForItem(template, item, barcodeId, markingRecordId).map((c) =>
    t(`labels.domainIssues.${c}`),
  );
}
