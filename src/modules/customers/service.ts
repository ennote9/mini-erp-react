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
  contactPerson?: string;
  taxId?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  country?: string;
  paymentTermsDays?: number;
};
export type SaveCustomerResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validatePaymentTermsDays(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value))
    return "Payment terms must be a valid number.";
  if (value < 0) return "Payment terms cannot be negative.";
  return null;
}

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

  const paymentErr = validatePaymentTermsDays(data.paymentTermsDays);
  if (paymentErr) return paymentErr;

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
  const contactPerson = normalizeTrim(data.contactPerson) || undefined;
  const taxId = normalizeTrim(data.taxId) || undefined;
  const billingAddress = normalizeTrim(data.billingAddress) || undefined;
  const shippingAddress = normalizeTrim(data.shippingAddress) || undefined;
  const city = normalizeTrim(data.city) || undefined;
  const country = normalizeTrim(data.country) || undefined;
  const paymentTermsDays =
    data.paymentTermsDays !== undefined ? Number(data.paymentTermsDays) : undefined;

  const patch = {
    code,
    name,
    isActive: data.isActive,
    phone,
    email,
    comment,
    contactPerson,
    taxId,
    billingAddress,
    shippingAddress,
    city,
    country,
    paymentTermsDays,
  };

  if (existingId) {
    const updated = customerRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Customer not found." };
    return { success: true, id: existingId };
  }
  const created = customerRepository.create(patch);
  return { success: true, id: created.id };
}

export const customerService = {
  saveCustomer,
};
