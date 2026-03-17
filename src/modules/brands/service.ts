import { brandRepository } from "./repository";
import {
  validateRequired,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveBrandInput = {
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
};
export type SaveBrandResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validateSaveBrand(
  data: SaveBrandInput,
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
  const duplicate = brandRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "A brand with this code already exists.";
  return null;
}

export function saveBrand(
  data: SaveBrandInput,
  existingId?: string,
): SaveBrandResult {
  const err = validateSaveBrand(data, existingId);
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
    const updated = brandRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Brand not found." };
    return { success: true, id: existingId };
  }
  const created = brandRepository.create(patch);
  return { success: true, id: created.id };
}

export const brandService = {
  saveBrand,
};
