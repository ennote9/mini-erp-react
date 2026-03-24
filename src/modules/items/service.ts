import { itemRepository, flushPendingItemsPersist } from "./repository";
import type { ItemBarcode, ItemBarcodePackagingLevel, ItemBarcodeType } from "./model";
import { brandRepository } from "../brands/repository";
import { categoryRepository } from "../categories/repository";
import {
  validateRequired,
  validateItemCode,
  validateUOM,
  normalizeTrim,
  normalizeCode,
  normalizeUOM,
  NAME_MIN_LENGTH,
} from "../../shared/validation";
import {
  barcodeCodeValueExistsGlobally,
  normalizeItemBarcodeDraft,
  validateItemBarcodeDraft,
  type ItemBarcodeDraft,
} from "./lib/itemBarcodes";

export type SaveItemInput = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  brandId?: string;
  categoryId?: string;
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
};
export type SaveItemResult =
  | { success: true; id: string }
  | { success: false; error: string };
export type SaveItemBarcodeResult =
  | { success: true; barcodeId: string }
  | { success: false; error: string };

function validatePrice(value: number | undefined, fieldName: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value))
    return `${fieldName} must be a valid number.`;
  if (value < 0) return `${fieldName} cannot be negative.`;
  return null;
}

function validateSaveItem(data: SaveItemInput, existingId?: string): string | null {
  const codeErr = validateItemCode(data.code);
  if (codeErr) return codeErr;
  const nameErr = validateRequired(data.name, "Name");
  if (nameErr) return nameErr;
  const nameTrimmed = normalizeTrim(data.name);
  if (nameTrimmed.length < NAME_MIN_LENGTH)
    return `Name must be at least ${NAME_MIN_LENGTH} characters.`;
  const uomErr = validateUOM(data.uom);
  if (uomErr) return uomErr;

  const purchaseErr = validatePrice(data.purchasePrice, "Purchase price");
  if (purchaseErr) return purchaseErr;
  const saleErr = validatePrice(data.salePrice, "Sale price");
  if (saleErr) return saleErr;

  if (data.brandId !== undefined && data.brandId !== "") {
    const brand = brandRepository.getById(data.brandId);
    if (!brand) return "Selected brand not found.";
    if (!brand.isActive) return "Selected brand is not active.";
  }

  if (data.categoryId !== undefined && data.categoryId !== "") {
    const category = categoryRepository.getById(data.categoryId);
    if (!category) return "Selected category not found.";
    if (!category.isActive) return "Selected category is not active.";
  }

  const codeNormalized = normalizeCode(data.code);
  const duplicate = itemRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "An item with this code already exists.";
  return null;
}

export function saveItem(
  data: SaveItemInput,
  existingId?: string,
): SaveItemResult {
  const err = validateSaveItem(data, existingId);
  if (err) return { success: false, error: err };

  const code = normalizeCode(data.code);
  const name = normalizeTrim(data.name);
  const uom = normalizeUOM(data.uom);
  const description = normalizeTrim(data.description) || undefined;
  const brandId = data.brandId && data.brandId.trim() !== "" ? data.brandId.trim() : undefined;
  const categoryId = data.categoryId && data.categoryId.trim() !== "" ? data.categoryId.trim() : undefined;
  const barcode = normalizeTrim(data.barcode) || undefined;
  const purchasePrice = data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined;
  const salePrice = data.salePrice !== undefined ? Number(data.salePrice) : undefined;

  const patch = {
    code,
    name,
    uom,
    isActive: data.isActive,
    description,
    brandId,
    categoryId,
    barcode,
    purchasePrice,
    salePrice,
  };

  if (existingId) {
    const updated = itemRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Item not found." };
    return { success: true, id: existingId };
  }
  const created = itemRepository.create(patch);
  return { success: true, id: created.id };
}

function nextItemBarcodeId(itemId: string): string {
  return `${itemId}-bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveItemBarcode(
  itemId: string,
  draft: ItemBarcodeDraft,
  existingBarcodeId?: string,
): SaveItemBarcodeResult {
  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const err = validateItemBarcodeDraft(draft);
  if (err) return { success: false, error: err };
  const normalized = normalizeItemBarcodeDraft(draft);
  const duplicate = barcodeCodeValueExistsGlobally(itemRepository.list(), normalized.codeValue, {
    excludeItemId: itemId,
    excludeBarcodeId: existingBarcodeId,
  });
  if (duplicate) {
    return { success: false, error: "This barcode already exists for another item." };
  }
  const existing = item.barcodes ?? [];
  const nextId = existingBarcodeId ?? nextItemBarcodeId(itemId);
  const replacement: ItemBarcode = {
    id: nextId,
    itemId,
    codeValue: normalized.codeValue,
    barcodeType: normalized.barcodeType as ItemBarcodeType,
    packagingLevel: normalized.packagingLevel as ItemBarcodePackagingLevel,
    isPrimary: normalized.isPrimary,
    isActive: normalized.isActive,
    comment: normalized.comment,
  };
  const next =
    existingBarcodeId == null
      ? [...existing, replacement]
      : existing.map((b) => (b.id === existingBarcodeId ? replacement : b));
  const updated = itemRepository.update(itemId, { barcodes: next });
  if (!updated) return { success: false, error: "Item not found." };
  return { success: true, barcodeId: nextId };
}

export function removeItemBarcode(itemId: string, barcodeId: string): SaveItemBarcodeResult {
  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const existing = item.barcodes ?? [];
  const next = existing.filter((b) => b.id !== barcodeId);
  if (next.length === existing.length) {
    return { success: false, error: "Barcode not found." };
  }
  const updated = itemRepository.update(itemId, { barcodes: next });
  if (!updated) return { success: false, error: "Item not found." };
  return { success: true, barcodeId };
}

/**
 * Validates and saves like {@link saveItem}, then waits until items.json persistence completes.
 * Use from Item save flow so navigation does not outrun disk write.
 */
export async function saveItemAwaitPersist(
  data: SaveItemInput,
  existingId?: string,
): Promise<SaveItemResult> {
  const r = saveItem(data, existingId);
  if (!r.success) return r;
  try {
    await flushPendingItemsPersist();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg || "Could not save items to disk." };
  }
  return r;
}

export const itemService = {
  saveItem,
  saveItemAwaitPersist,
  saveItemBarcode,
  removeItemBarcode,
};
