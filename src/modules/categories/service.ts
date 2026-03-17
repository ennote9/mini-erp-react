import { categoryRepository } from "./repository";
import {
  validateRequired,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveCategoryInput = {
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
};
export type SaveCategoryResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validateSaveCategory(
  data: SaveCategoryInput,
  existingId?: string,
): string | null {
  const codeErr = validateRequired(data.code, "Code");
  if (codeErr) return codeErr;
  const codeTrimmed = normalizeTrim(data.code);
  if (codeTrimmed === "") return "Code is required.";

  const nameErr = validateRequired(data.name, "Name");
  if (nameErr) return nameErr;
  const nameTrimmed = normalizeTrim(data.name);
  if (nameTrimmed.length < NAME_MIN_LENGTH)
    return `Name must be at least ${NAME_MIN_LENGTH} characters.`;

  const codeNormalized = normalizeCode(data.code);
  const duplicate = categoryRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "A category with this code already exists.";
  return null;
}

export function saveCategory(
  data: SaveCategoryInput,
  existingId?: string,
): SaveCategoryResult {
  const err = validateSaveCategory(data, existingId);
  if (err) return { success: false, error: err };

  const code = normalizeCode(data.code);
  const name = normalizeTrim(data.name);
  const comment = normalizeTrim(data.comment) || undefined;

  const patch = {
    code,
    name,
    isActive: data.isActive,
    comment,
  };

  if (existingId) {
    const updated = categoryRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Category not found." };
    return { success: true, id: existingId };
  }
  const created = categoryRepository.create(patch);
  return { success: true, id: created.id };
}

export const categoryService = {
  saveCategory,
};
