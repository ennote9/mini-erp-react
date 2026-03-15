import { customerRepository } from "./repository";
import {
  validateRequired,
  validatePhone,
  validateEmail,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";

export type SaveCustomerInput = {
  code: string;
  name: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  comment?: string;
};
export type SaveCustomerResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validateSaveCustomer(
  data: SaveCustomerInput,
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
  const emailErr = validateEmail(data.email);
  if (emailErr) return emailErr;

  const codeNormalized = normalizeCode(data.code);
  const duplicate = customerRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "A customer with this code already exists.";
  return null;
}

export function saveCustomer(
  data: SaveCustomerInput,
  existingId?: string,
): SaveCustomerResult {
  const err = validateSaveCustomer(data, existingId);
  if (err) return { success: false, error: err };

  const code = normalizeCode(data.code);
  const name = normalizeTrim(data.name);
  const phone = normalizeTrim(data.phone) || undefined;
  const email = normalizeTrim(data.email) || undefined;
  const comment = normalizeTrim(data.comment) || undefined;

  if (existingId) {
    const updated = customerRepository.update(existingId, {
      code,
      name,
      isActive: data.isActive,
      phone,
      email,
      comment,
    });
    if (!updated) return { success: false, error: "Customer not found." };
    return { success: true, id: existingId };
  }
  const created = customerRepository.create({
    code,
    name,
    isActive: data.isActive,
    phone,
    email,
    comment,
  });
  return { success: true, id: created.id };
}

export const customerService = {
  saveCustomer,
};
