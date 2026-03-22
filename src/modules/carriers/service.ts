import { carrierRepository } from "./repository";
import {
  validateRequired,
  validatePhone,
  validateEmail,
  normalizeTrim,
  normalizeCode,
  NAME_MIN_LENGTH,
} from "../../shared/validation";
import { isCarrierTypeId, type CarrierTypeId } from "./model";

export type SaveCarrierInput = {
  code: string;
  name: string;
  isActive: boolean;
  carrierType: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  country?: string;
  city?: string;
  address?: string;
  comment?: string;
  trackingUrlTemplate?: string;
  serviceLevelDefault?: string;
  paymentTermsDays?: number;
};

export type SaveCarrierResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validatePaymentTermsDays(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== "number" || Number.isNaN(value))
    return "Payment terms must be a valid number.";
  if (value < 0) return "Payment terms cannot be negative.";
  return null;
}

function validateSaveCarrier(data: SaveCarrierInput, existingId?: string): string | null {
  const codeErr = validateRequired(data.code, "Code");
  if (codeErr) return codeErr;
  const codeTrimmed = normalizeTrim(data.code);
  if (codeTrimmed === "") return "Code is required.";

  const nameErr = validateRequired(data.name, "Name");
  if (nameErr) return nameErr;
  const nameTrimmed = normalizeTrim(data.name);
  if (nameTrimmed.length < NAME_MIN_LENGTH)
    return `Name must be at least ${NAME_MIN_LENGTH} characters.`;

  if (!isCarrierTypeId(data.carrierType.trim())) {
    return "Select a valid carrier type.";
  }

  const phoneErr = validatePhone(data.phone);
  if (phoneErr) return phoneErr;
  const emailErr = validateEmail(data.email);
  if (emailErr) return emailErr;

  const paymentErr = validatePaymentTermsDays(data.paymentTermsDays);
  if (paymentErr) return paymentErr;

  const codeNormalized = normalizeCode(data.code);
  const duplicate = carrierRepository.list().find(
    (x) => x.code.toUpperCase() === codeNormalized && x.id !== existingId,
  );
  if (duplicate) return "A carrier with this code already exists.";
  return null;
}

export function saveCarrier(data: SaveCarrierInput, existingId?: string): SaveCarrierResult {
  const err = validateSaveCarrier(data, existingId);
  if (err) return { success: false, error: err };

  const code = normalizeCode(data.code);
  const name = normalizeTrim(data.name);
  const carrierType = data.carrierType.trim() as CarrierTypeId;
  const contactPerson = normalizeTrim(data.contactPerson) || undefined;
  const phone = normalizeTrim(data.phone) || undefined;
  const email = normalizeTrim(data.email) || undefined;
  const website = normalizeTrim(data.website) || undefined;
  const country = normalizeTrim(data.country) || undefined;
  const city = normalizeTrim(data.city) || undefined;
  const address = normalizeTrim(data.address) || undefined;
  const comment = normalizeTrim(data.comment) || undefined;
  const trackingUrlTemplate = normalizeTrim(data.trackingUrlTemplate) || undefined;
  const serviceLevelDefault = normalizeTrim(data.serviceLevelDefault) || undefined;
  const paymentTermsDays =
    data.paymentTermsDays !== undefined ? Number(data.paymentTermsDays) : undefined;

  const patch = {
    code,
    name,
    isActive: data.isActive,
    carrierType,
    contactPerson,
    phone,
    email,
    website,
    country,
    city,
    address,
    comment,
    trackingUrlTemplate,
    serviceLevelDefault,
    paymentTermsDays,
  };

  if (existingId) {
    const updated = carrierRepository.update(existingId, patch);
    if (!updated) return { success: false, error: "Carrier not found." };
    return { success: true, id: existingId };
  }
  const created = carrierRepository.create(patch);
  return { success: true, id: created.id };
}

export const carrierService = {
  saveCarrier,
};
