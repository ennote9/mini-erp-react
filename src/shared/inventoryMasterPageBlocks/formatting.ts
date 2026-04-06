import { useAppDisplayFormatters } from "@/shared/formatting";

/** Shared display formatting for master inventory blocks (Item / Brand / Category). */
export function useMasterInventoryFormatters() {
  const { formatDateTime, formatNumber } = useAppDisplayFormatters();

  const formatQty = (n: number): string =>
    formatNumber(n, {
      minFractionDigits: Number.isInteger(n) ? 0 : 2,
      maxFractionDigits: 2,
      empty: "0",
    });

  const formatQtyDelta = (v: number): string => {
    const base = formatQty(v);
    return v > 0 ? `+${base}` : base;
  };

  const formatDateTimeDisplay = (iso: string | null | undefined): string =>
    iso == null ? "" : formatDateTime(iso, { empty: "" });

  return {
    formatQty,
    formatQtyDelta,
    formatDateTimeDisplay,
  };
}
