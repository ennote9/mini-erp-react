import { warehouseRepository } from "./repository";
import {
  validateRequired,
  validatePhone,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveWarehouseInput = {
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
  warehouseType?: string;
  address?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
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

  const phoneErr = validatePhone(data.phone);
  if (phoneErr) return phoneErr;

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
  const warehouseType = normalizeTrim(data.warehouseType) || undefined;
  const address = normalizeTrim(data.address) || undefined;
  const city = normalizeTrim(data.city) || undefined;
  const country = normalizeTrim(data.country) || undefined;
  const contactPerson = normalizeTrim(data.contactPerson) || undefined;
  const phone = normalizeTrim(data.phone) || undefined;

  const patch = {
    code,
    name,
    isActive: data.isActive,
    comment,
    warehouseType,
    address,
    city,
    country,
    contactPerson,
    phone,
  };

  if (existingId) {
    const updated = warehouseRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Warehouse not found." };
    return { success: true, id: existingId };
  }
  const created = warehouseRepository.create(patch);
  return { success: true, id: created.id };
}

export const warehouseService = {
  saveWarehouse,
};
