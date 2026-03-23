import type { ItemPageBalanceSummary } from "@/modules/items/itemInventoryRelated";
import { useTranslation } from "@/shared/i18n/context";
import { formatMasterInventoryQty } from "./formatting";

type Props = {
  summary: ItemPageBalanceSummary;
  /** Accessibility label for the chip group (page-specific i18n). */
  ariaLabel: string;
};

/**
 * Summary chips for warehouse count + operational totals (same keys as Item page: `master.item.chip*`).
 */
export function MasterStockBalanceSummaryChips({ summary, ariaLabel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1.5" aria-label={ariaLabel}>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipWarehouses")}</span>
        <span className="font-medium text-foreground/90">{summary.warehouseCount}</span>
      </span>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipTotalOnHand")}</span>
        <span className="font-medium text-foreground/90">
          {formatMasterInventoryQty(summary.totalOnHand)}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipTotalReserved")}</span>
        <span className="font-medium text-foreground/90">
          {formatMasterInventoryQty(summary.totalReserved)}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipTotalAvailable")}</span>
        <span className="font-medium text-foreground/90">
          {formatMasterInventoryQty(summary.totalAvailable)}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipTotalOutgoing")}</span>
        <span className="font-medium text-foreground/90">
          {formatMasterInventoryQty(summary.totalOutgoing)}
        </span>
      </span>
      <span className="inline-flex items-baseline gap-1 rounded border border-border/50 bg-muted/25 px-2 py-0.5 text-[11px] tabular-nums leading-none">
        <span className="text-muted-foreground">{t("master.item.chipTotalIncoming")}</span>
        <span className="font-medium text-foreground/90">
          {formatMasterInventoryQty(summary.totalIncoming)}
        </span>
      </span>
    </div>
  );
}
