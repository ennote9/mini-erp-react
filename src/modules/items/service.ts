import { itemRepository } from "./repository";
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

export const itemService = {
  saveItem,
};
