import { normalizeTrim } from "@/shared/validation";
import { validateDateForSO } from "@/modules/sales-orders/dateUtils";
import { todayYYYYMMDD } from "@/modules/sales-orders/dateUtils";
import type { CustomerAgreement, CustomerAgreementPricingType } from "./model";
import { customerAgreementRepository } from "./repository";
import { customerRepository } from "@/modules/customers/repository";

export type SaveCustomerAgreementInput = {
  customerId: string;
  agreementNo: string;
  name?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  currency: string;
  pricingType: CustomerAgreementPricingType;
  discountPercent?: number;
  paymentTermsDays?: number;
};

export type SaveCustomerAgreementResult =
  | { success: true; id: string }
  | { success: false; error: string };

function normalizeOptionalString(v: string | undefined): string | undefined {
  const t = normalizeTrim(v);
  return t === "" ? undefined : t;
}

function validateAgreementInput(
  data: SaveCustomerAgreementInput,
  existingId?: string,
): string | null {
  const customerId = normalizeTrim(data.customerId);
  if (customerId === "") return "Customer is required.";
  const customer = customerRepository.getById(customerId);
  if (!customer) return "Customer is required.";

  const agreementNo = normalizeTrim(data.agreementNo);
  if (agreementNo === "") return "Agreement number is required.";

  const startDate = normalizeTrim(data.startDate);
  if (startDate === "") return "Start date is required.";
  const startDateErr = validateDateForSO(startDate);
  if (startDateErr) return startDateErr.replace(/^Date\b/, "Start date");

  const endDate = normalizeTrim(data.endDate);
  if (endDate !== "") {
    const endDateErr = validateDateForSO(endDate);
    if (endDateErr) return endDateErr.replace(/^Date\b/, "End date");
    if (endDate < startDate) return "End date cannot be earlier than start date.";
  }

  const currency = normalizeTrim(data.currency).toUpperCase();
  if (currency === "") return "Currency is required.";

  if (data.pricingType === "discount_percent") {
    if (data.discountPercent === undefined || Number.isNaN(data.discountPercent)) {
      return "Discount percent is required for discount pricing.";
    }
    if (data.discountPercent < 0 || data.discountPercent > 100) {
      return "Discount percent must be between 0 and 100.";
    }
  }

  if (data.paymentTermsDays !== undefined) {
    if (!Number.isFinite(data.paymentTermsDays) || data.paymentTermsDays < 0) {
      return "Payment terms cannot be negative.";
    }
    if (!Number.isInteger(data.paymentTermsDays)) {
      return "Payment terms must be a whole number.";
    }
  }

  const duplicate = customerAgreementRepository.listByCustomer(customerId).find(
    (x) =>
      x.agreementNo.trim().toUpperCase() === agreementNo.toUpperCase() &&
      x.id !== existingId,
  );
  if (duplicate) return "Agreement number already exists for this customer.";
  return null;
}

export function saveCustomerAgreement(
  data: SaveCustomerAgreementInput,
  existingId?: string,
): SaveCustomerAgreementResult {
  const err = validateAgreementInput(data, existingId);
  if (err) return { success: false, error: err };

  const customerId = normalizeTrim(data.customerId);
  const agreementNo = normalizeTrim(data.agreementNo).toUpperCase();
  const name = normalizeOptionalString(data.name);
  const startDate = normalizeTrim(data.startDate);
  const endDate = normalizeOptionalString(data.endDate);
  const currency = normalizeTrim(data.currency).toUpperCase();
  const discountPercent =
    data.pricingType === "discount_percent" && data.discountPercent !== undefined
      ? Number(data.discountPercent)
      : undefined;
  const paymentTermsDays =
    data.paymentTermsDays !== undefined ? Number(data.paymentTermsDays) : undefined;

  if (existingId) {
    const existing = customerAgreementRepository.getById(existingId);
    if (!existing) return { success: false, error: "Agreement not found." };
    const updated = customerAgreementRepository.update(existingId, {
      agreementNo,
      name,
      startDate,
      endDate,
      isActive: data.isActive,
      currency,
      pricingType: data.pricingType,
      discountPercent,
      paymentTermsDays,
    });
    if (!updated) return { success: false, error: "Agreement not found." };
    return { success: true, id: updated.id };
  }

  const created = customerAgreementRepository.create({
    customerId,
    agreementNo,
    name,
    startDate,
    endDate,
    isActive: data.isActive,
    currency,
    pricingType: data.pricingType,
    discountPercent,
    paymentTermsDays,
  });
  return { success: true, id: created.id };
}

function isAgreementApplicable(agreement: CustomerAgreement, asOfDate: string): boolean {
  if (!agreement.isActive) return false;
  if (agreement.startDate > asOfDate) return false;
  if (agreement.endDate && agreement.endDate < asOfDate) return false;
  return true;
}

/**
 * Deterministic active agreement resolution:
 * 1) isActive + date-applicable (start<=asOf<=end|open)
 * 2) latest startDate
 * 3) latest updatedAt
 * 4) highest numeric id
 */
export function resolveActiveCustomerAgreement(
  customerId: string,
  asOfDate: string = todayYYYYMMDD(),
): CustomerAgreement | undefined {
  const candidates = customerAgreementRepository
    .listByCustomer(customerId)
    .filter((agreement) => isAgreementApplicable(agreement, asOfDate))
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
      if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10);
    });
  return candidates[0];
}

export const customerAgreementService = {
  saveCustomerAgreement,
  resolveActiveCustomerAgreement,
};

