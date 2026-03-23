import type { KeyboardEvent } from "react";
import type { ItemPageMovementRow } from "@/modules/items/itemInventoryRelated";
import type { MasterScopeMovementRow } from "@/shared/masterInventoryByItemScope";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/shared/i18n/context";
import { formatMasterInventoryDateTime, formatMasterInventoryQtyDelta } from "./formatting";

export type MasterStockMovementsBlockLabels = {
  title: string;
  description: string;
  openAll: string;
  empty: string;
};

type BaseProps = {
  labels: MasterStockMovementsBlockLabels;
  onOpenAll: () => void;
  movementTypeLabel: (code: string) => string;
};

type SingleItemProps = BaseProps & {
  variant: "singleItem";
  rows: ItemPageMovementRow[];
  /** Row click: add warehouse (and any scope) to the list URL. Defaults to `onOpenAll`. */
  onMovementRowClick?: (row: ItemPageMovementRow) => void;
  rowAriaLabel: (row: ItemPageMovementRow) => string;
};

type ScopedProps = BaseProps & {
  variant: "scoped";
  rows: MasterScopeMovementRow[];
  onMovementRowClick?: (row: MasterScopeMovementRow) => void;
  rowAriaLabel: (row: MasterScopeMovementRow) => string;
};

export type MasterStockMovementsBlockProps = SingleItemProps | ScopedProps;

function rowKeyDown(e: KeyboardEvent, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

/**
 * Recent stock movements: single-item (Item page) or scoped multi-item (Brand / Category).
 */
export function MasterStockMovementsBlock(props: MasterStockMovementsBlockProps) {
  const { t } = useTranslation();
  const { labels, onOpenAll, movementTypeLabel, variant, rows } = props;

  return (
    <Card className="mt-4 w-full max-w-4xl min-w-0 border-0 shadow-none">
      <CardHeader className="p-2 pb-0.5 space-y-0">
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1.5">
          <div className="min-w-0 space-y-0.5 flex-1">
            <CardTitle className="text-[0.9rem] font-semibold tracking-tight">{labels.title}</CardTitle>
            <CardDescription className="text-xs leading-snug">{labels.description}</CardDescription>
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
      </CardHeader>
      <CardContent className="p-2 pt-1 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 m-0">{labels.empty}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-md border border-border/60">
            <table className="list-table text-sm">
              <thead>
                <tr>
                  <th className="min-w-[140px]">{t("doc.columns.dateTime")}</th>
                  {variant === "scoped" ? (
                    <>
                      <th className="list-table__cell--code">{t("doc.columns.itemCode")}</th>
                      <th className="min-w-[120px]">{t("doc.columns.itemName")}</th>
                    </>
                  ) : null}
                  <th className="min-w-[100px]">{t("doc.columns.movementType")}</th>
                  <th className="min-w-[120px]">{t("doc.columns.warehouse")}</th>
                  <th className="w-28 text-right whitespace-nowrap tabular-nums">
                    {t("doc.columns.qtyDelta")}
                  </th>
                  <th className={variant === "scoped" ? "min-w-[140px]" : "min-w-[160px]"}>
                    {t("doc.columns.sourceDocument")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {variant === "singleItem"
                  ? (() => {
                      const p = props as SingleItemProps;
                      const rowNav =
                        p.onMovementRowClick ?? ((_row: ItemPageMovementRow) => onOpenAll());
                      return (rows as ItemPageMovementRow[]).map((row) => (
                      <tr
                        key={row.id}
                        className="list-table__row list-table__row--clickable"
                        onClick={() => rowNav(row)}
                        role="button"
                        tabIndex={0}
                        aria-label={p.rowAriaLabel(row)}
                        onKeyDown={(e) => rowKeyDown(e, () => rowNav(row))}
                      >
                        <td className="whitespace-nowrap tabular-nums">
                          {formatMasterInventoryDateTime(row.datetime)}
                        </td>
                        <td>{movementTypeLabel(row.movementTypeCode)}</td>
                        <td className="truncate max-w-[14rem]" title={row.warehouseName}>
                          {row.warehouseName}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatMasterInventoryQtyDelta(row.qtyDelta)}
                        </td>
                        <td className="truncate max-w-[18rem]" title={row.sourceDocumentLabel}>
                          {row.sourceDocumentLabel}
                        </td>
                      </tr>
                    ));
                    })()
                  : (() => {
                      const p = props as ScopedProps;
                      const rowNav =
                        p.onMovementRowClick ?? ((_row: MasterScopeMovementRow) => onOpenAll());
                      return (rows as MasterScopeMovementRow[]).map((row) => (
                      <tr
                        key={row.id}
                        className="list-table__row list-table__row--clickable"
                        onClick={() => rowNav(row)}
                        role="button"
                        tabIndex={0}
                        aria-label={p.rowAriaLabel(row)}
                        onKeyDown={(e) => rowKeyDown(e, () => rowNav(row))}
                      >
                        <td className="whitespace-nowrap tabular-nums">
                          {formatMasterInventoryDateTime(row.datetime)}
                        </td>
                        <td className="list-table__cell--code font-mono text-xs">{row.itemCode}</td>
                        <td className="truncate max-w-[12rem]" title={row.itemName}>
                          {row.itemName}
                        </td>
                        <td>{movementTypeLabel(row.movementTypeCode)}</td>
                        <td className="truncate max-w-[14rem]" title={row.warehouseName}>
                          {row.warehouseName}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatMasterInventoryQtyDelta(row.qtyDelta)}
                        </td>
                        <td className="truncate max-w-[16rem]" title={row.sourceDocumentLabel}>
                          {row.sourceDocumentLabel}
                        </td>
                      </tr>
                    ));
                    })()}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
