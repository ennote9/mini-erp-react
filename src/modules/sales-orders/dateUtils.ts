/**
 * Sales Order date handling: storage and HTML input type="date" use YYYY-MM-DD.
 * Year is constrained to 1900-2100 to avoid malformed display (e.g. 22005).
 * Same discipline as Purchase Orders.
 */

const DATE_YYYYMMDD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
export const SO_DATE_MIN_YEAR = 1900;
export const SO_DATE_MAX_YEAR = 2100;

export function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize to YYYY-MM-DD for storage and input type="date".
 * Invalid or out-of-range year becomes today.
 */
export function normalizeDateForSO(value: string | undefined): string {
  if (!value || typeof value !== "string") return todayYYYYMMDD();
  const trimmed = value.trim();
  const match = trimmed.match(DATE_YYYYMMDD_REGEX);
  if (!match) return todayYYYYMMDD();
  const year = parseInt(match[1], 10);
  if (year < SO_DATE_MIN_YEAR || year > SO_DATE_MAX_YEAR) return todayYYYYMMDD();
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Returns error message if date is not YYYY-MM-DD or year is out of range; null if valid. */
export function validateDateForSO(value: string | undefined): string | null {
  if (!value || typeof value !== "string" || !value.trim()) return "Date is required.";
  const trimmed = value.trim();
  const match = trimmed.match(DATE_YYYYMMDD_REGEX);
  if (!match) return "Date must be in YYYY-MM-DD format (e.g. 2025-03-15).";
  const year = parseInt(match[1], 10);
  if (year < SO_DATE_MIN_YEAR || year > SO_DATE_MAX_YEAR)
    return `Date year must be between ${SO_DATE_MIN_YEAR} and ${SO_DATE_MAX_YEAR}.`;
  return null;
}
