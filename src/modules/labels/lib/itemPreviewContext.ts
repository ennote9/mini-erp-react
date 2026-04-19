import type { Item, ItemBarcode } from "@/modules/items/model";
import type { LabelPreviewBindingContext } from "./previewContext";

export type ItemPreviewWarningCode = "barcodeNotFound" | "barcodeInactive" | "noActiveBarcodes";

function formatPriceAmount(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function pickPrimaryBarcode(active: ItemBarcode[]): ItemBarcode | undefined {
  return active.find((b) => b.isPrimary) ?? active[0];
}

/**
 * Builds label binding preview context from a catalog item and optional barcode row id.
 * Does not persist; safe for workspace preview and future print jobs.
 */
export function buildItemPreviewBindingContext(
  item: Item,
  options: { barcodeId?: string | null },
): {
  context: LabelPreviewBindingContext;
  warnings: ItemPreviewWarningCode[];
  resolvedSelectedId: string | undefined;
  resolvedPrimaryId: string | undefined;
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

  const context: LabelPreviewBindingContext = {
    item: {
      name: item.name,
      code: item.code,
      salePrice: formatPriceAmount(item.salePrice),
      purchasePrice: formatPriceAmount(item.purchasePrice),
      brandId: item.brandId,
      categoryId: item.categoryId,
      translationName: item.translationName,
      translationDescription: item.translationDescription,
      markingCode: item.markingCode,
      kizCode: item.kizCode,
    },
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
  };
}
