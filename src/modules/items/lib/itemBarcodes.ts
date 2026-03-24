import type {
  Item,
  ItemBarcode,
  ItemBarcodePackagingLevel,
  ItemBarcodeRole,
  ItemBarcodeSourceType,
  ItemBarcodeSymbology,
} from "../model";
import { normalizeTrim } from "@/shared/validation";

export const ITEM_BARCODE_SYMBOLOGIES: readonly ItemBarcodeSymbology[] = [
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

/** @deprecated Use {@link ITEM_BARCODE_SYMBOLOGIES}. */
export const ITEM_BARCODE_TYPES = ITEM_BARCODE_SYMBOLOGIES;

export const ITEM_BARCODE_PACKAGING_LEVELS: readonly ItemBarcodePackagingLevel[] = [
  "UNIT",
  "INNER",
  "CASE",
  "PALLET",
  "LOGISTICS",
  "CUSTOM",
];

export const ITEM_BARCODE_ROLES: readonly ItemBarcodeRole[] = [
  "SELLABLE",
  "INTERNAL",
  "SUPPLIER",
  "LOGISTICS",
  "OTHER",
];

export const ITEM_BARCODE_SOURCE_TYPES: readonly ItemBarcodeSourceType[] = [
  "MANUFACTURER",
  "INTERNAL",
  "SUPPLIER",
  "GENERATED",
  "OTHER",
];

function isSymbology(v: string): v is ItemBarcodeSymbology {
  return (ITEM_BARCODE_SYMBOLOGIES as readonly string[]).includes(v);
}

function isPackagingLevel(v: string): v is ItemBarcodePackagingLevel {
  return (ITEM_BARCODE_PACKAGING_LEVELS as readonly string[]).includes(v);
}

function isBarcodeRole(v: string): v is ItemBarcodeRole {
  return (ITEM_BARCODE_ROLES as readonly string[]).includes(v);
}

function isSourceType(v: string): v is ItemBarcodeSourceType {
  return (ITEM_BARCODE_SOURCE_TYPES as readonly string[]).includes(v);
}

function nextBarcodeId(itemId: string): string {
  return `${itemId}-bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBySymbologyCodeValue(raw: string, symbology: ItemBarcodeSymbology): string {
  const trimmed = normalizeTrim(raw);
  if (symbology === "EAN_13" || symbology === "EAN_8" || symbology === "UPC_A" || symbology === "UPC_E" || symbology === "ITF_14") {
    return trimmed.replace(/\s+/g, "");
  }
  return trimmed;
}

export function validateBarcodeCodeValueBySymbology(codeValue: string, symbology: ItemBarcodeSymbology): string | null {
  const v = normalizeBySymbologyCodeValue(codeValue, symbology);
  if (v === "") return "Barcode value is required.";
  if (symbology === "EAN_13" && !/^\d{13}$/.test(v)) return "EAN-13 must be exactly 13 digits.";
  if (symbology === "EAN_8" && !/^\d{8}$/.test(v)) return "EAN-8 must be exactly 8 digits.";
  if (symbology === "UPC_A" && !/^\d{12}$/.test(v)) return "UPC-A must be exactly 12 digits.";
  if (symbology === "UPC_E" && !/^\d{6,8}$/.test(v)) return "UPC-E must be 6–8 digits.";
  if (symbology === "ITF_14" && !/^\d{14}$/.test(v)) return "ITF-14 must be exactly 14 digits.";
  return null;
}

/** @deprecated Use {@link validateBarcodeCodeValueBySymbology}. */
export function validateBarcodeCodeValueByType(codeValue: string, barcodeType: ItemBarcodeSymbology): string | null {
  return validateBarcodeCodeValueBySymbology(codeValue, barcodeType);
}

export type ItemBarcodeDraft = {
  codeValue: string;
  symbology: ItemBarcodeSymbology;
  packagingLevel: ItemBarcodePackagingLevel;
  barcodeRole: ItemBarcodeRole;
  sourceType: ItemBarcodeSourceType;
  isPrimary: boolean;
  isActive: boolean;
  comment?: string;
};

export function validateItemBarcodeDraft(input: ItemBarcodeDraft): string | null {
  if (!isSymbology(input.symbology)) return "Symbology is required.";
  if (!isPackagingLevel(input.packagingLevel)) return "Packaging level is required.";
  if (!isBarcodeRole(input.barcodeRole)) return "Barcode role is required.";
  if (!isSourceType(input.sourceType)) return "Source type is required.";
  return validateBarcodeCodeValueBySymbology(input.codeValue, input.symbology);
}

export function normalizeItemBarcodeDraft(input: ItemBarcodeDraft): ItemBarcodeDraft {
  return {
    ...input,
    codeValue: normalizeBySymbologyCodeValue(input.codeValue, input.symbology),
    comment: normalizeTrim(input.comment) || undefined,
  };
}

/** Primary active UNIT, else primary any level, else first active — for legacy `item.barcode` bridge. */
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
    if (!isSymbology(row.symbology) || !isPackagingLevel(row.packagingLevel)) continue;
    const role: ItemBarcodeRole = isBarcodeRole(row.barcodeRole) ? row.barcodeRole : "SELLABLE";
    const source: ItemBarcodeSourceType = isSourceType(row.sourceType) ? row.sourceType : "OTHER";
    const codeValue = normalizeBySymbologyCodeValue(row.codeValue, row.symbology);
    if (codeValue === "") continue;
    seenIds.add(row.id);
    out.push({
      ...row,
      symbology: row.symbology,
      barcodeRole: role,
      sourceType: source,
      codeValue,
      comment: normalizeTrim(row.comment) || undefined,
    });
  }
  return ensurePrimaryPerPackagingLevel(out);
}

/** Legacy single flat barcode → one structured row (assumed EAN-13 UNIT for seed/migration). */
export function makeLegacyPrimaryUnitBarcode(itemId: string, rawCode: string): ItemBarcode | null {
  const codeValue = normalizeTrim(rawCode);
  if (!codeValue) return null;
  return {
    id: nextBarcodeId(itemId),
    itemId,
    codeValue,
    symbology: "EAN_13",
    packagingLevel: "UNIT",
    barcodeRole: "SELLABLE",
    sourceType: "MANUFACTURER",
    isPrimary: true,
    isActive: true,
  };
}

/**
 * Global uniqueness of normalized codeValue across all items and all barcode rows (active + inactive).
 * Legacy `item.barcode` participates only when no structured row on that item carries the same value
 * (pre-migration / odd files).
 */
export function barcodeCodeValueExistsGlobally(
  items: Item[],
  codeValue: string,
  opts?: { excludeItemId?: string; excludeBarcodeId?: string },
): boolean {
  const target = normalizeTrim(codeValue);
  if (!target) return false;
  const targetLower = target.toLowerCase();
  for (const item of items) {
    if (opts?.excludeItemId && item.id === opts.excludeItemId) {
      for (const b of item.barcodes ?? []) {
        if (opts.excludeBarcodeId && b.id === opts.excludeBarcodeId) continue;
        if (normalizeTrim(b.codeValue).toLowerCase() === targetLower) return true;
      }
      continue;
    }
    for (const b of item.barcodes ?? []) {
      if (normalizeTrim(b.codeValue).toLowerCase() === targetLower) return true;
    }
    const legacy = normalizeTrim(item.barcode ?? "");
    if (legacy && legacy.toLowerCase() === targetLower) {
      const covered = (item.barcodes ?? []).some(
        (b) => normalizeTrim(b.codeValue).toLowerCase() === targetLower,
      );
      if (!covered) return true;
    }
  }
  return false;
}
