import type { Item } from "@/modules/items/model";
import type { LabelTemplate } from "../model";
import { listSelectableMarkingRecordsForItem } from "@/modules/items/markingRecordService";
import { collectLabelDomainIssueCodesForItem } from "./labelDomainValidation";
import { buildItemPreviewBindingContext } from "./itemPreviewContext";

export type LabelBatchTableRow = {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  barcodeId: string;
  /** Selected marking pool record for domain templates; empty string if none. */
  markingRecordId: string;
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

function pickDefaultMarkingRecordId(item: Item, template?: LabelTemplate): string | undefined {
  if (!template) return undefined;
  const records = listSelectableMarkingRecordsForItem(item.id);
  if (template.kind === "KIZ_LABEL") {
    const kiz = records.filter((r) => r.kind === "KIZ");
    if (kiz.length === 1) return kiz[0].id;
  }
  if (template.kind === "DATAMATRIX_LABEL") {
    const dm = records.filter((r) => r.kind === "DATAMATRIX" || r.kind === "GS1_DATAMATRIX");
    if (dm.length === 1) return dm[0].id;
  }
  return undefined;
}

function resolveMarkingRecordId(
  item: Item,
  requested: string | undefined,
  template: LabelTemplate | undefined,
): string {
  const trimmed = requested?.trim() ?? "";
  if (trimmed) {
    const rec = listSelectableMarkingRecordsForItem(item.id).find((r) => r.id === trimmed);
    return rec ? rec.id : "";
  }
  const auto = pickDefaultMarkingRecordId(item, template);
  return auto ?? "";
}

export function buildBatchRowFromItem(
  item: Item,
  opts: { barcodeId?: string; copies?: number; rowId?: string; template?: LabelTemplate; markingRecordId?: string },
): LabelBatchTableRow {
  const copies = opts.copies != null && opts.copies >= 1 && opts.copies <= 999 ? opts.copies : 1;
  let barcodeId = opts.barcodeId ?? pickDefaultBarcodeId(item) ?? "";
  const active = item.barcodes.filter((b) => b.isActive);
  if (barcodeId && !active.some((b) => b.id === barcodeId)) {
    barcodeId = pickDefaultBarcodeId(item) ?? "";
  }

  const markingRecordId = resolveMarkingRecordId(item, opts.markingRecordId, opts.template);

  const built = buildItemPreviewBindingContext(item, {
    barcodeId: barcodeId || undefined,
    markingRecordId: markingRecordId || undefined,
  });
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
    const domainCodes = collectLabelDomainIssueCodesForItem(
      opts.template,
      item,
      barcodeId || undefined,
      markingRecordId || undefined,
    );
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
    markingRecordId,
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
    markingRecordId: row.markingRecordId || undefined,
    copies: row.copies,
    rowId: row.id,
    template,
  });
}
