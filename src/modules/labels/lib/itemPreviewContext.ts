import type { Item, ItemBarcode } from "@/modules/items/model";
import type { ItemMarkingRecord } from "@/modules/items/model/itemMarkingRecord";
import { markingRecordRepository } from "@/modules/items/markingRecordRepository";
import type { LabelPreviewBindingContext } from "./previewContext";

export type ItemPreviewWarningCode = "barcodeNotFound" | "barcodeInactive" | "noActiveBarcodes" | "markingRecordNotFound";

function formatPriceAmount(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function pickPrimaryBarcode(active: ItemBarcode[]): ItemBarcode | undefined {
  return active.find((b) => b.isPrimary) ?? active[0];
}

function isMarkingRecordSelectableForPreview(r: ItemMarkingRecord): boolean {
  return r.status === "AVAILABLE" || r.status === "RESERVED" || r.status === "PRINTED";
}

function applyMarkingRecordToItemSlice(
  base: LabelPreviewBindingContext["item"],
  record: ItemMarkingRecord,
): LabelPreviewBindingContext["item"] {
  const next = { ...base };
  switch (record.kind) {
    case "MARKING":
      next.markingCode = record.payload;
      break;
    case "KIZ":
      next.kizCode = record.payload;
      break;
    case "DATAMATRIX":
      next.dataMatrixPayload = record.payload;
      break;
    case "GS1_DATAMATRIX":
      next.gs1DataMatrixPayload = record.payload;
      break;
    default: {
      const _e: never = record.kind;
      return _e;
    }
  }
  return next;
}

export type BuildItemPreviewOptions = {
  barcodeId?: string | null;
  markingRecordId?: string | null;
};

/**
 * Builds label binding preview context from a catalog item and optional barcode / marking record ids.
 * When a marking record is selected, its payload is merged into `item` fields for legacy field bindings;
 * `marking.*` carries the explicit selection for new bindings.
 */
export function buildItemPreviewBindingContext(
  item: Item,
  options: BuildItemPreviewOptions,
): {
  context: LabelPreviewBindingContext;
  warnings: ItemPreviewWarningCode[];
  resolvedSelectedId: string | undefined;
  resolvedPrimaryId: string | undefined;
  resolvedMarkingRecordId: string | undefined;
} {
  const warnings: ItemPreviewWarningCode[] = [];
  const activeBarcodes = item.barcodes.filter((b) => b.isActive);
  const primary = pickPrimaryBarcode(activeBarcodes);

  let selected: ItemBarcode | undefined;

  if (options.barcodeId) {
    const found = item.barcodes.find((b) => b.id === options.barcodeId);
    if (!found) {
      warnings.push("barcodeNotFound");
      selected = primary;
    } else if (!found.isActive) {
      warnings.push("barcodeInactive");
      selected = primary;
    } else {
      selected = found;
    }
  } else {
    selected = primary;
  }

  if (activeBarcodes.length === 0 && item.barcodes.length > 0) {
    warnings.push("noActiveBarcodes");
  }

  const primaryValue = primary?.codeValue ?? "";
  const selectedValue = selected?.codeValue ?? primaryValue;

  const baseItemSlice: LabelPreviewBindingContext["item"] = {
    name: item.name,
    code: item.code,
    salePrice: formatPriceAmount(item.salePrice),
    purchasePrice: formatPriceAmount(item.purchasePrice),
    brandId: item.brandId,
    categoryId: item.categoryId,
    translationName: item.translationName,
    translationDescription: item.translationDescription,
    translationComposition: item.translationComposition,
    translationCountry: item.translationCountry,
    translationImporter: item.translationImporter,
    translationExtraText: item.translationExtraText,
    markingCode: item.markingCode,
    kizCode: item.kizCode,
    dataMatrixPayload: item.dataMatrixPayload,
    gs1DataMatrixPayload: item.gs1DataMatrixPayload,
    markingComment: item.markingComment,
  };

  const pool = markingRecordRepository.listByItemId(item.id);
  let resolvedMarkingRecordId: string | undefined;
  let markingSlice: LabelPreviewBindingContext["marking"] | undefined;

  let selectedMarkingRecord: ItemMarkingRecord | undefined;
  if (options.markingRecordId) {
    const rec = pool.find((r) => r.id === options.markingRecordId && r.itemId === item.id);
    if (!rec) {
      warnings.push("markingRecordNotFound");
    } else if (isMarkingRecordSelectableForPreview(rec)) {
      resolvedMarkingRecordId = rec.id;
      selectedMarkingRecord = rec;
      markingSlice = {
        selectedId: rec.id,
        selectedKind: rec.kind,
        selectedPayload: rec.payload,
        selectedHumanLabel: rec.humanLabel,
        selectedStatus: rec.status,
      };
    }
  }

  const itemSlice = selectedMarkingRecord
    ? applyMarkingRecordToItemSlice(baseItemSlice, selectedMarkingRecord)
    : baseItemSlice;

  const context: LabelPreviewBindingContext = {
    item: itemSlice,
    marking: markingSlice,
    selectedBarcode: selectedValue,
    primaryBarcode: primaryValue,
    barcodes: item.barcodes.map((b) => ({
      codeValue: b.codeValue,
      packagingLevel: b.packagingLevel,
      barcodeRole: b.barcodeRole,
      isActive: b.isActive,
    })),
  };

  return {
    context,
    warnings,
    resolvedSelectedId: selected?.id,
    resolvedPrimaryId: primary?.id,
    resolvedMarkingRecordId,
  };
}
