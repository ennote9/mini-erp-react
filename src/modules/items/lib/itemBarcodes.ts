import type { Item, ItemBarcode, ItemBarcodePackagingLevel, ItemBarcodeType } from "../model";
import { normalizeTrim } from "@/shared/validation";

export const ITEM_BARCODE_TYPES: readonly ItemBarcodeType[] = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "GS1_128",
  "ITF_14",
  "QR",
  "GS1_QR",
  "DATAMATRIX",
  "GS1_DATAMATRIX",
  "OTHER",
];

export const ITEM_BARCODE_PACKAGING_LEVELS: readonly ItemBarcodePackagingLevel[] = [
  "UNIT",
  "INNER",
  "CASE",
  "PALLET",
  "LOGISTICS",
  "CUSTOM",
];

function isBarcodeType(v: string): v is ItemBarcodeType {
  return (ITEM_BARCODE_TYPES as readonly string[]).includes(v);
}

function isPackagingLevel(v: string): v is ItemBarcodePackagingLevel {
  return (ITEM_BARCODE_PACKAGING_LEVELS as readonly string[]).includes(v);
}

function nextBarcodeId(itemId: string): string {
  return `${itemId}-bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeByTypeCodeValue(raw: string, type: ItemBarcodeType): string {
  const trimmed = normalizeTrim(raw);
  if (type === "EAN_13" || type === "EAN_8" || type === "UPC_A" || type === "UPC_E" || type === "ITF_14") {
    return trimmed.replace(/\s+/g, "");
  }
  return trimmed;
}

export function validateBarcodeCodeValueByType(codeValue: string, barcodeType: ItemBarcodeType): string | null {
  const v = normalizeByTypeCodeValue(codeValue, barcodeType);
  if (v === "") return "Barcode value is required.";
  if (barcodeType === "EAN_13" && !/^\d{13}$/.test(v)) return "EAN-13 must be exactly 13 digits.";
  if (barcodeType === "EAN_8" && !/^\d{8}$/.test(v)) return "EAN-8 must be exactly 8 digits.";
  if (barcodeType === "UPC_A" && !/^\d{12}$/.test(v)) return "UPC-A must be exactly 12 digits.";
  if (barcodeType === "ITF_14" && !/^\d{14}$/.test(v)) return "ITF-14 must be exactly 14 digits.";
  return null;
}

export type ItemBarcodeDraft = {
  codeValue: string;
  barcodeType: ItemBarcodeType;
  packagingLevel: ItemBarcodePackagingLevel;
  isPrimary: boolean;
  isActive: boolean;
  comment?: string;
};

export function validateItemBarcodeDraft(input: ItemBarcodeDraft): string | null {
  if (!isBarcodeType(input.barcodeType)) return "Barcode type is required.";
  if (!isPackagingLevel(input.packagingLevel)) return "Packaging level is required.";
  return validateBarcodeCodeValueByType(input.codeValue, input.barcodeType);
}

export function normalizeItemBarcodeDraft(input: ItemBarcodeDraft): ItemBarcodeDraft {
  return {
    ...input,
    codeValue: normalizeByTypeCodeValue(input.codeValue, input.barcodeType),
    comment: normalizeTrim(input.comment) || undefined,
  };
}

export function bridgeLegacyBarcodeValueFromCollection(barcodes: ItemBarcode[]): string | undefined {
  const active = barcodes.filter((b) => b.isActive);
  const primaryUnit = active.find((b) => b.packagingLevel === "UNIT" && b.isPrimary);
  if (primaryUnit) return primaryUnit.codeValue;
  const primaryAny = active.find((b) => b.isPrimary);
  if (primaryAny) return primaryAny.codeValue;
  return active[0]?.codeValue;
}

export function ensurePrimaryPerPackagingLevel(barcodes: ItemBarcode[]): ItemBarcode[] {
  const byLevel = new Map<ItemBarcodePackagingLevel, ItemBarcode[]>();
  for (const b of barcodes) {
    const arr = byLevel.get(b.packagingLevel) ?? [];
    arr.push(b);
    byLevel.set(b.packagingLevel, arr);
  }
  const normalized: ItemBarcode[] = [];
  for (const arr of byLevel.values()) {
    const primaryIndex = arr.findIndex((x) => x.isPrimary);
    for (let i = 0; i < arr.length; i++) {
      normalized.push({ ...arr[i], isPrimary: primaryIndex >= 0 ? i === primaryIndex : false });
    }
  }
  return normalized;
}

export function normalizeItemBarcodesCollection(input: ItemBarcode[]): ItemBarcode[] {
  const seenIds = new Set<string>();
  const out: ItemBarcode[] = [];
  for (const row of input) {
    if (!row || seenIds.has(row.id)) continue;
    if (!isBarcodeType(row.barcodeType) || !isPackagingLevel(row.packagingLevel)) continue;
    const codeValue = normalizeByTypeCodeValue(row.codeValue, row.barcodeType);
    if (codeValue === "") continue;
    seenIds.add(row.id);
    out.push({
      ...row,
      codeValue,
      comment: normalizeTrim(row.comment) || undefined,
    });
  }
  return ensurePrimaryPerPackagingLevel(out);
}

export function makeLegacyPrimaryUnitBarcode(itemId: string, rawCode: string): ItemBarcode | null {
  const codeValue = normalizeTrim(rawCode);
  if (!codeValue) return null;
  return {
    id: nextBarcodeId(itemId),
    itemId,
    codeValue,
    barcodeType: "EAN_13",
    packagingLevel: "UNIT",
    isPrimary: true,
    isActive: true,
  };
}

export function barcodeCodeValueExistsGlobally(
  items: Item[],
  codeValue: string,
  opts?: { excludeItemId?: string; excludeBarcodeId?: string },
): boolean {
  const target = normalizeTrim(codeValue);
  if (!target) return false;
  for (const item of items) {
    if (opts?.excludeItemId && item.id === opts.excludeItemId) {
      for (const b of item.barcodes ?? []) {
        if (opts.excludeBarcodeId && b.id === opts.excludeBarcodeId) continue;
        if (normalizeTrim(b.codeValue) === target) return true;
      }
      continue;
    }
    for (const b of item.barcodes ?? []) {
      if (normalizeTrim(b.codeValue) === target) return true;
    }
    const legacy = normalizeTrim(item.barcode);
    if (legacy && legacy === target) return true;
  }
  return false;
}
