import type { Item } from "@/modules/items/model";
import type { LabelTemplate } from "../model";
import { collectLabelDomainIssueCodesForItem } from "./labelDomainValidation";
import { buildItemPreviewBindingContext } from "./itemPreviewContext";

export type LabelBatchTableRow = {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  barcodeId: string;
  barcodeValue: string;
  copies: number;
  isValid: boolean;
  validationMessage?: string;
};

function pickDefaultBarcodeId(item: Item): string | undefined {
  const active = item.barcodes.filter((b) => b.isActive);
  if (active.length === 0) return undefined;
  return active.find((b) => b.isPrimary)?.id ?? active[0]?.id;
}

export function buildBatchRowFromItem(
  item: Item,
  opts: { barcodeId?: string; copies?: number; rowId?: string; template?: LabelTemplate },
): LabelBatchTableRow {
  const copies = opts.copies != null && opts.copies >= 1 && opts.copies <= 999 ? opts.copies : 1;
  let barcodeId = opts.barcodeId ?? pickDefaultBarcodeId(item) ?? "";
  const active = item.barcodes.filter((b) => b.isActive);
  if (barcodeId && !active.some((b) => b.id === barcodeId)) {
    barcodeId = pickDefaultBarcodeId(item) ?? "";
  }

  const built = buildItemPreviewBindingContext(item, { barcodeId: barcodeId || undefined });
  const resolvedValue =
    built.context.selectedBarcode ||
    built.context.primaryBarcode ||
    item.barcodes.find((b) => b.id === barcodeId)?.codeValue ||
    "";

  let isValid = true;
  let validationMessage: string | undefined;
  if (active.length === 0) {
    isValid = false;
    validationMessage = "noActiveBarcodes";
  } else if (!barcodeId) {
    isValid = false;
    validationMessage = "noBarcode";
  } else if (built.warnings.includes("noActiveBarcodes")) {
    isValid = false;
    validationMessage = "noActiveBarcodes";
  }

  if (isValid && opts.template) {
    const domainCodes = collectLabelDomainIssueCodesForItem(opts.template, item, barcodeId || undefined);
    if (domainCodes.length > 0) {
      isValid = false;
      validationMessage = "domainDataMissing";
    }
  }

  return {
    id: opts.rowId ?? crypto.randomUUID(),
    itemId: item.id,
    itemName: item.name,
    itemCode: item.code,
    barcodeId,
    barcodeValue: resolvedValue,
    copies,
    isValid,
    validationMessage,
  };
}

export function refreshBatchRowFromItem(
  row: LabelBatchTableRow,
  item: Item | undefined,
  template?: LabelTemplate,
): LabelBatchTableRow {
  if (!item) {
    return {
      ...row,
      isValid: false,
      validationMessage: "itemMissing",
    };
  }
  return buildBatchRowFromItem(item, {
    barcodeId: row.barcodeId,
    copies: row.copies,
    rowId: row.id,
    template,
  });
}
