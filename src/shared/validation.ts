/**
 * Shared validation and normalization for master data.
 * Clear, user-facing error messages. No document validation here.
 */

export const NAME_MIN_LENGTH = 2;
export const UOM_MIN_LENGTH = 1;
export const UOM_MAX_LENGTH = 10;

/** Item code: letters, digits, dash, underscore only. */
export const ITEM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Phone: digits, spaces, +, -, (, ). At least one digit. */
const PHONE_PATTERN = /^[\d\s+\-()]+$/;
const PHONE_HAS_DIGIT = /\d/;

/** Simple email: local@domain.tld */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeTrim(value: string | undefined): string {
  return value == null ? "" : String(value).trim();
}

export function validateRequired(value: string | undefined, fieldName: string): string | null {
  const t = normalizeTrim(value);
  if (t === "") return `${fieldName} is required.`;
  return null;
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (value.length < min) return `${fieldName} must be at least ${min} characters.`;
  return null;
}

export function validateItemCode(code: string | undefined): string | null {
  const err = validateRequired(code, "Code");
  if (err) return err;
  const t = normalizeTrim(code!);
  if (!ITEM_CODE_PATTERN.test(t)) return "Code may only contain letters, numbers, hyphens, and underscores.";
  return null;
}

export function validateUOM(uom: string | undefined): string | null {
  const err = validateRequired(uom, "UOM");
  if (err) return err;
  const t = normalizeTrim(uom!);
  if (t.length < UOM_MIN_LENGTH) return "UOM is required.";
  if (t.length > UOM_MAX_LENGTH) return `UOM must be ${UOM_MAX_LENGTH} characters or fewer.`;
  return null;
}

export function validatePhone(phone: string | undefined): string | null {
  const t = normalizeTrim(phone);
  if (t === "") return null;
  if (!PHONE_PATTERN.test(t)) return "Phone format is invalid. Use only digits, spaces, +, -, and parentheses.";
  if (!PHONE_HAS_DIGIT.test(t)) return "Phone must contain at least one digit.";
  return null;
}

export function validateEmail(email: string | undefined): string | null {
  const t = normalizeTrim(email);
  if (t === "") return null;
  if (!EMAIL_PATTERN.test(t)) return "Email format is invalid.";
  return null;
}

/** Normalize code to uppercase for consistent storage. */
export function normalizeCode(code: string | undefined): string {
  return normalizeTrim(code).toUpperCase();
}

/** Normalize UOM to uppercase. */
export function normalizeUOM(uom: string | undefined): string {
  return normalizeTrim(uom).toUpperCase();
}
