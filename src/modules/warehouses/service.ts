import { warehouseRepository } from "./repository";
import {
  validateRequired,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveWarehouseInput = {
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
};
export type SaveWarehouseResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validateSaveWarehouse(
  data: SaveWarehouseInput,
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
  const duplicate = warehouseRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "A warehouse with this code already exists.";
  return null;
}

export function saveWarehouse(
  data: SaveWarehouseInput,
  existingId?: string,
): SaveWarehouseResult {
  const err = validateSaveWarehouse(data, existingId);
  if (err) return { success: false, error: err };

  const code = normalizeCode(data.code);
  const name = normalizeTrim(data.name);
  const comment = normalizeTrim(data.comment) || undefined;

  if (existingId) {
    const updated = warehouseRepository.update(existingId, {
      code,
      name,
      isActive: data.isActive,
      comment,
    });
    if (!updated) return { success: false, error: "Warehouse not found." };
    return { success: true, id: existingId };
  }
  const created = warehouseRepository.create({
    code,
    name,
    isActive: data.isActive,
    comment,
  });
  return { success: true, id: created.id };
}

export const warehouseService = {
  saveWarehouse,
};
