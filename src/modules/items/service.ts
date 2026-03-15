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
};
export type SaveItemResult =
  | { success: true; id: string }
  | { success: false; error: string };

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

  if (existingId) {
    const updated = itemRepository.update(existingId, {
      code,
      name,
      uom,
      isActive: data.isActive,
      description,
    });
    if (!updated) return { success: false, error: "Item not found." };
    return { success: true, id: existingId };
  }
  const created = itemRepository.create({
    code,
    name,
    uom,
    isActive: data.isActive,
    description,
  });
  return { success: true, id: created.id };
}

export const itemService = {
  saveItem,
};
