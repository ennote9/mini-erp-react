import type { DateFormatId, NumberFormatId } from "@/shared/settings/types";

type NumberFormatOptions = {
  minFractionDigits?: number;
  maxFractionDigits?: number;
  empty?: string;
};

type DateFormatOptions = {
  empty?: string;
};

type DateTimeFormatOptions = {
  empty?: string;
  includeSeconds?: boolean;
};

type AppDisplayFormatters = {
  formatDate: (value: string | null | undefined, options?: DateFormatOptions) => string;
  formatDateTime: (value: string | null | undefined, options?: DateTimeFormatOptions) => string;
  formatNumber: (value: number | null | undefined, options?: NumberFormatOptions) => string;
  formatMoney: (value: number | null | undefined, fractionDigits?: number, empty?: string) => string;
};

const DEFAULT_EMPTY = "—";

const numberStyleBySetting: Record<NumberFormatId, { group: string; decimal: string }> = {
  spaceComma: { group: " ", decimal: "," },
  commaDot: { group: ",", decimal: "." },
  dotComma: { group: ".", decimal: "," },
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function clampFractionDigits(minFractionDigits?: number, maxFractionDigits?: number): { min: number; max: number } {
  const max = Math.min(6, Math.max(0, maxFractionDigits ?? 2));
  const min = Math.min(max, Math.max(0, minFractionDigits ?? 0));
  return { min, max };
}

function parseYyyyMmDd(value: string): Date | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function formatDateParts(date: Date, dateFormat: DateFormatId): string {
  const yyyy = String(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  if (dateFormat === "eu") return `${dd}.${mm}.${yyyy}`;
  if (dateFormat === "us") return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateLike(value: string): Date | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const strictDate = parseYyyyMmDd(normalized);
  if (strictDate) return strictDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function createAppDisplayFormatters(dateFormat: DateFormatId, numberFormat: NumberFormatId): AppDisplayFormatters {
  const numberStyle = numberStyleBySetting[numberFormat];

  const formatDate = (value: string | null | undefined, options?: DateFormatOptions): string => {
    const empty = options?.empty ?? DEFAULT_EMPTY;
    if (typeof value !== "string" || value.trim() === "") return empty;
    const parsed = parseDateLike(value);
    if (!parsed) return value;
    return formatDateParts(parsed, dateFormat);
  };

  const formatDateTime = (value: string | null | undefined, options?: DateTimeFormatOptions): string => {
    const empty = options?.empty ?? DEFAULT_EMPTY;
    if (typeof value !== "string" || value.trim() === "") return empty;
    const parsed = parseDateLike(value);
    if (!parsed) return value;
    const datePart = formatDateParts(parsed, dateFormat);
    const timePart = options?.includeSeconds
      ? `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`
      : `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
    return `${datePart} ${timePart}`;
  };

  const formatNumber = (value: number | null | undefined, options?: NumberFormatOptions): string => {
    const empty = options?.empty ?? DEFAULT_EMPTY;
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return empty;

    const { min, max } = clampFractionDigits(options?.minFractionDigits, options?.maxFractionDigits);
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const fixed = abs.toFixed(max);
    const [integerPartRaw, fractionRaw = ""] = fixed.split(".");

    let fraction = fractionRaw;
    while (fraction.length > min && fraction.endsWith("0")) fraction = fraction.slice(0, -1);

    const integerPart = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, numberStyle.group);
    if (fraction.length === 0) return `${sign}${integerPart}`;
    return `${sign}${integerPart}${numberStyle.decimal}${fraction}`;
  };

  const formatMoney = (value: number | null | undefined, fractionDigits = 2, empty?: string): string =>
    formatNumber(value, {
      minFractionDigits: fractionDigits,
      maxFractionDigits: fractionDigits,
      empty,
    });

  return {
    formatDate,
    formatDateTime,
    formatNumber,
    formatMoney,
  };
}

