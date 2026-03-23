import type { KeyboardEvent } from "react";
import type { ItemPageBalanceRow, ItemPageBalanceSummary } from "@/modules/items/itemInventoryRelated";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { MasterStockBalanceSummaryChips } from "./MasterStockBalanceSummaryChips";
import { formatMasterInventoryQty } from "./formatting";

export type MasterStockBalancesBlockLabels = {
  title: string;
  /** Omitted on some pages (e.g. category) when the section title is enough. */
  description?: string;
  openAll: string;
  summaryAria: string;
  empty: string;
};

type Props = {
  labels: MasterStockBalancesBlockLabels;
  summary: ItemPageBalanceSummary;
  rows: ItemPageBalanceRow[];
  /** Header / open-all: broad list scope (e.g. item or brand only). */
  onOpenAll: () => void;
  /**
   * Warehouse row: narrower list (adds warehouse when the row carries it).
   * Defaults to `onOpenAll` if omitted.
   */
  onBalanceRowClick?: (row: ItemPageBalanceRow) => void;
  rowAriaLabel: (row: ItemPageBalanceRow) => string;
  /** When true, the outline "open all" button is not shown in the card header (caller renders it elsewhere). */
  hideHeaderOpenButton?: boolean;
};

function rowKeyDown(e: KeyboardEvent, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

/**
 * Stock balances by warehouse: summary chips, open-all, empty state, clickable rows (Item + Brand + Category).
 */
export function MasterStockBalancesBlock({
  labels,
  summary,
  rows,
  onOpenAll,
  onBalanceRowClick,
  rowAriaLabel,
  hideHeaderOpenButton = false,
}: Props) {
  const { t } = useTranslation();
  const rowNavigate = onBalanceRowClick ?? ((_row: ItemPageBalanceRow) => onOpenAll());

  return (
    <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
      <CardHeader className="p-2 pb-0.5 space-y-0">
        {hideHeaderOpenButton ? (
          <div className={`min-w-0 ${labels.description ? "space-y-0.5" : ""}`}>
            <CardTitle className="text-[0.9rem] font-semibold tracking-tight">{labels.title}</CardTitle>
            {labels.description ? (
              <CardDescription className="text-xs leading-snug">{labels.description}</CardDescription>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
            <div className={`min-w-0 flex-1 ${labels.description ? "space-y-0.5" : ""}`}>
              <CardTitle className="text-[0.9rem] font-semibold tracking-tight">{labels.title}</CardTitle>
              {labels.description ? (
                <CardDescription className="text-xs leading-snug">{labels.description}</CardDescription>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2.5 text-xs"
              onClick={onOpenAll}
            >
              {labels.openAll}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 pt-1 space-y-2">
        <MasterStockBalanceSummaryChips summary={summary} ariaLabel={labels.summaryAria} />
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 m-0">{labels.empty}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
            <table className="list-table text-sm">
              <thead>
                <tr>
                  <th className="min-w-[120px]">{t("doc.columns.warehouse")}</th>
                  <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.total")}</th>
                  <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.reserved")}</th>
                  <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.available")}</th>
                  <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.outgoing")}</th>
                  <th className="w-24 text-right whitespace-nowrap tabular-nums">{t("doc.columns.incoming")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.warehouseId}
                    className="list-table__row list-table__row--clickable"
                    onClick={() => rowNavigate(row)}
                    role="button"
                    tabIndex={0}
                    aria-label={rowAriaLabel(row)}
                    onKeyDown={(e) => rowKeyDown(e, () => rowNavigate(row))}
                  >
                    <td className="truncate max-w-[14rem]" title={row.warehouseName}>
                      {row.warehouseName}
                    </td>
                    <td className="text-right tabular-nums">{formatMasterInventoryQty(row.qtyOnHand)}</td>
                    <td className="text-right tabular-nums">{formatMasterInventoryQty(row.reservedQty)}</td>
                    <td className="text-right tabular-nums">{formatMasterInventoryQty(row.availableQty)}</td>
                    <td className="text-right tabular-nums">{formatMasterInventoryQty(row.outgoingQty)}</td>
                    <td className="text-right tabular-nums">{formatMasterInventoryQty(row.incomingQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
