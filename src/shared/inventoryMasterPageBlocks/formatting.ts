/** Shared number/datetime display for master pages (Item / Brand / Category inventory blocks). */

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatMasterInventoryQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function formatMasterInventoryQtyDelta(v: number): string {
  const base = formatMasterInventoryQty(v);
  return v > 0 ? `+${base}` : base;
}

export function formatMasterInventoryDateTime(iso: string | null | undefined): string {
  if (iso == null) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(undefined, DATE_TIME_FORMAT);
}
