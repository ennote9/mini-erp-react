import type { Item } from "../model";

/** Editable label-related fields (mass-edit); stored on Item. */
export type ItemLabelDataDraft = {
  translationName: string;
  translationDescription: string;
  translationComposition: string;
  translationCountry: string;
  translationImporter: string;
  translationExtraText: string;
  markingCode: string;
  kizCode: string;
  dataMatrixPayload: string;
  gs1DataMatrixPayload: string;
  markingComment: string;
};

export const LABEL_DATA_FIELD_KEYS: (keyof ItemLabelDataDraft)[] = [
  "translationName",
  "translationDescription",
  "translationComposition",
  "translationCountry",
  "translationImporter",
  "translationExtraText",
  "markingCode",
  "kizCode",
  "dataMatrixPayload",
  "gs1DataMatrixPayload",
  "markingComment",
];

export function emptyLabelDataDraft(): ItemLabelDataDraft {
  return {
    translationName: "",
    translationDescription: "",
    translationComposition: "",
    translationCountry: "",
    translationImporter: "",
    translationExtraText: "",
    markingCode: "",
    kizCode: "",
    dataMatrixPayload: "",
    gs1DataMatrixPayload: "",
    markingComment: "",
  };
}

export function itemToLabelDataDraft(item: Item): ItemLabelDataDraft {
  return {
    translationName: item.translationName ?? "",
    translationDescription: item.translationDescription ?? "",
    translationComposition: item.translationComposition ?? "",
    translationCountry: item.translationCountry ?? "",
    translationImporter: item.translationImporter ?? "",
    translationExtraText: item.translationExtraText ?? "",
    markingCode: item.markingCode ?? "",
    kizCode: item.kizCode ?? "",
    dataMatrixPayload: item.dataMatrixPayload ?? "",
    gs1DataMatrixPayload: item.gs1DataMatrixPayload ?? "",
    markingComment: item.markingComment ?? "",
  };
}

export function draftsEqual(a: ItemLabelDataDraft, b: ItemLabelDataDraft): boolean {
  return LABEL_DATA_FIELD_KEYS.every((k) => (a[k] ?? "").trim() === (b[k] ?? "").trim());
}

/** Trim strings; empty → undefined for repository patch. */
export function draftToItemPatch(draft: ItemLabelDataDraft): Partial<Item> {
  const trim = (s: string) => s.trim();
  const opt = (s: string) => {
    const t = trim(s);
    return t === "" ? undefined : t;
  };
  return {
    translationName: opt(draft.translationName),
    translationDescription: opt(draft.translationDescription),
    translationComposition: opt(draft.translationComposition),
    translationCountry: opt(draft.translationCountry),
    translationImporter: opt(draft.translationImporter),
    translationExtraText: opt(draft.translationExtraText),
    markingCode: opt(draft.markingCode),
    kizCode: opt(draft.kizCode),
    dataMatrixPayload: opt(draft.dataMatrixPayload),
    gs1DataMatrixPayload: opt(draft.gs1DataMatrixPayload),
    markingComment: opt(draft.markingComment),
  };
}

/** Build patch only for fields that differ between baseline and draft (normalized trim). */
export function diffLabelDraftPatch(
  baseline: ItemLabelDataDraft,
  draft: ItemLabelDataDraft,
): Partial<Item> {
  const full = draftToItemPatch(draft);
  const base = draftToItemPatch(baseline);
  const patch: Partial<Item> = {};
  for (const k of LABEL_DATA_FIELD_KEYS) {
    const key = k as keyof ItemLabelDataDraft;
    if (full[key] !== base[key]) {
      (patch as Record<string, unknown>)[key] = full[key];
    }
  }
  return patch;
}

export function hasTranslationDisplayContent(item: Item): boolean {
  return [item.translationName, item.translationDescription, item.translationComposition, item.translationExtraText].some(
    (s) => s?.trim(),
  );
}

export function hasMarkingContent(item: Item): boolean {
  return !!(
    item.markingCode?.trim() ||
    item.kizCode?.trim() ||
    item.dataMatrixPayload?.trim() ||
    item.gs1DataMatrixPayload?.trim()
  );
}

export type LabelDataFilter =
  | "all"
  | "no_translation"
  | "no_marking"
  | "no_datamatrix"
  | "no_kiz_marking"
  | "issues";

export function applyLabelDataFilter(items: Item[], f: LabelDataFilter): Item[] {
  if (f === "all") return items;
  return items.filter((item) => {
    if (f === "no_translation") return !hasTranslationDisplayContent(item);
    if (f === "no_marking") return !hasMarkingContent(item);
    if (f === "no_datamatrix") {
      return !item.dataMatrixPayload?.trim() && !item.gs1DataMatrixPayload?.trim();
    }
    if (f === "no_kiz_marking") {
      return !item.kizCode?.trim() && !item.markingCode?.trim();
    }
    if (f === "issues") {
      return !hasTranslationDisplayContent(item) || !hasMarkingContent(item);
    }
    return true;
  });
}

export function primaryBarcodeValue(item: Item): string {
  const active = item.barcodes?.filter((b) => b.isActive) ?? [];
  const p = active.find((b) => b.isPrimary) ?? active[0];
  return p?.codeValue ?? "";
}
