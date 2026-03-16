import { itemRepository } from "./repository";
import {
  validateRequired,
  validateItemCode,
  validateUOM,
  normalizeTrim,
  normalizeCode,
  normalizeUOM,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveItemInput = {
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  brand?: string;
  category?: string;
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
};
export type SaveItemResult =
  | { success: true; id: string }
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
  const brand = normalizeTrim(data.brand) || undefined;
  const category = normalizeTrim(data.category) || undefined;
  const barcode = normalizeTrim(data.barcode) || undefined;
  const purchasePrice = data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined;
  const salePrice = data.salePrice !== undefined ? Number(data.salePrice) : undefined;

  const patch = {
    code,
    name,
    uom,
    isActive: data.isActive,
    description,
    brand,
    category,
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

export const itemService = {
  saveItem,
};
