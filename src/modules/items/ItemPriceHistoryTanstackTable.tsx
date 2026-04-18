import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Funnel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n";
import type { PriceHistoryRow } from "./lib/itemPriceHistory";
import type { ItemPriceHistoryColumnSchema } from "./itemPriceHistoryTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

const columnHelper = createColumnHelper<PriceHistoryRow>();

function statusBadgeClasses(status: PriceHistoryRow["status"]): string {
  switch (status) {
    case "active":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-100";
    case "scheduled":
      return "border-sky-500/35 bg-sky-500/12 text-sky-100";
    case "cancelled":
      return "border-destructive/40 bg-destructive/15 text-destructive-foreground";
    case "superseded":
      return "border-border/60 bg-muted/40 text-muted-foreground";
    default:
      return "border-border/60 bg-muted/30 text-foreground";
  }
}

type Props = {
  rows: PriceHistoryRow[];
  schema: ItemPriceHistoryColumnSchema[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onHeaderFilterClick?: (fieldId: string, anchorRect: { left: number; top: number; width: number; height: number }) => void;
  headerFilterState?: Record<string, boolean>;
  openHeaderFilterFieldId?: string | null;
  t: TFunction;
  formatMoney: (n: number | undefined) => string;
  reasonLabel: (code: string) => string;
  statusLabel: (status: PriceHistoryRow["status"]) => string;
  busy: boolean;
  onCancelScheduled: (row: PriceHistoryRow) => void;
};

export function ItemPriceHistoryTanstackTable(props: Props) {
  const {
    rows,
    schema,
    sorting,
    onSortingChange,
    onHeaderFilterClick,
    headerFilterState,
    openHeaderFilterFieldId,
    t,
    formatMoney,
    reasonLabel,
    statusLabel,
    busy,
    onCancelScheduled,
  } = props;

  const schemaById = useMemo(() => new Map(schema.map((c) => [c.id, c])), [schema]);

  const columns = useMemo(() => {
    const defs: ColumnDef<PriceHistoryRow, unknown>[] = [];

    for (const col of schema) {
      const meta: ColumnMeta = { align: col.align };

      if (col.id === "actions") {
        defs.push(
          columnHelper.display({
            id: "actions",
            header: col.label,
            enableSorting: false,
            size: col.defaultSize,
            minSize: col.minSize,
            maxSize: col.maxSize,
            meta,
            cell: ({ row }) => {
              const r = row.original;
              return (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {r.status === "scheduled" && !r.cancelledAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={busy}
                      data-testid="item-prices-row-cancel-scheduled"
                      onClick={() => onCancelScheduled(r)}
                    >
                      {t("master.item.prices.actionCancel")}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              );
            },
          }),
        );
        continue;
      }

      const key = col.id as keyof PriceHistoryRow;
      defs.push(
        columnHelper.accessor(
          (row) => row[key] as unknown,
          {
            id: col.id,
            header: col.label,
            enableSorting: col.sortable,
            sortingFn: "alphanumeric",
            size: col.defaultSize,
            minSize: col.minSize,
            maxSize: col.maxSize,
            meta,
            cell: ({ row }) => {
              const r = row.original;
              switch (col.id) {
                case "priceType":
                  return r.priceType === "purchase"
                    ? t("master.item.prices.typePurchase")
                    : t("master.item.prices.typeSale");
                case "amount":
                  return (
                    <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(r.amount)}</span>
                  );
                case "validFrom":
                  return <span className="tabular-nums text-muted-foreground">{r.validFrom}</span>;
                case "validTo":
                  return (
                    <span className="tabular-nums text-muted-foreground">{r.validTo ?? "—"}</span>
                  );
                case "status":
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[10px] font-semibold leading-none",
                        statusBadgeClasses(r.status),
                      )}
                    >
                      {statusLabel(r.status)}
                    </Badge>
                  );
                case "reasonCode":
                  return <span className="leading-snug text-muted-foreground">{reasonLabel(r.reasonCode)}</span>;
                case "comment":
                  return (
                    <span className="line-clamp-3 break-words" title={r.comment ?? undefined}>
                      {r.comment ?? "—"}
                    </span>
                  );
                case "createdAt":
                  return (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {r.createdAt.slice(0, 19).replace("T", " ")}
                    </span>
                  );
                default:
                  return String(row.getValue(col.id) ?? "");
              }
            },
          },
        ),
      );
    }

    return defs;
  }, [schema, t, formatMoney, reasonLabel, statusLabel, busy, onCancelScheduled]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: true,
    state: { sorting },
    onSortingChange,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = table.getTotalSize();

  return (
    <div
      className="overflow-x-auto rounded-lg border border-border/60 bg-card/20 shadow-sm"
      data-testid="item-prices-history-table"
    >
      <div className="relative inline-block min-w-full align-top" style={{ width: Math.max(totalWidth, 640) }}>
        <table
          className="w-full border-collapse table-fixed text-xs leading-tight"
          style={{ width: Math.max(totalWidth, 640) }}
        >
          <colgroup>
            {visibleLeafColumns.map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <thead className="bg-muted/35 text-[11px]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/60">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortState = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const schemaColumn = schemaById.get(header.column.id);
                  const canFilter = schemaColumn?.filterable === true;
                  const hasActiveFilter = headerFilterState?.[header.column.id] === true;
                  const isOpenFilterField = openHeaderFilterFieldId === header.column.id;
                  const isLastHeaderCell = header.index === headerGroup.headers.length - 1;

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "group relative h-8 select-none px-2 py-1.5",
                        !isLastHeaderCell && "border-r border-border/50",
                        meta?.align === "right"
                          ? "text-right"
                          : meta?.align === "center"
                            ? "text-center"
                            : "text-left",
                      )}
                      style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex min-w-0 items-center gap-0.5">
                          {canSort ? (
                            <button
                              type="button"
                              data-testid={`item-prices-history-sort-${header.column.id}`}
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-0.5 rounded-sm px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                meta?.align === "right" && "justify-end",
                                meta?.align === "center" && "justify-center",
                              )}
                              title={String(header.column.columnDef.header ?? "")}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                              <span
                                className={cn(
                                  "flex h-3 w-3 shrink-0 items-center justify-center transition-opacity",
                                  sortState
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                                )}
                              >
                                {sortState === "asc" ? (
                                  <ChevronUp className="h-3 w-3 shrink-0" />
                                ) : sortState === "desc" ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-45" />
                                )}
                              </span>
                            </button>
                          ) : (
                            <div
                              className={cn(
                                "flex min-w-0 flex-1 items-center px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                                meta?.align === "right" && "justify-end",
                                meta?.align === "center" && "justify-center",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                            </div>
                          )}
                          {canFilter ? (
                            <button
                              type="button"
                              className={cn(
                                "relative z-10 shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                hasActiveFilter
                                  ? "text-primary opacity-100"
                                  : isOpenFilterField
                                    ? "text-muted-foreground/70 opacity-100"
                                    : "text-muted-foreground/70 opacity-0 group-hover:opacity-100",
                              )}
                              aria-label={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
                              title={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
                              data-testid={`item-prices-history-filter-${header.column.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                onHeaderFilterClick?.(header.column.id, {
                                  left: rect.left,
                                  top: rect.top,
                                  width: rect.width,
                                  height: rect.height,
                                });
                              }}
                            >
                              <Funnel className={cn("h-3 w-3", hasActiveFilter && "fill-current")} />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="text-[11px]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-[12px] text-muted-foreground"
                  colSpan={visibleLeafColumns.length || 1}
                >
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const visibleCells = row.getVisibleCells();
                return (
                  <tr
                    key={row.id}
                    data-testid="item-prices-history-row"
                    data-price-record-id={row.original.id}
                    className="border-t border-border/50 transition-colors hover:bg-muted/25"
                  >
                    {visibleCells.map((cell, cellIndex) => {
                      const cmeta = cell.column.columnDef.meta as ColumnMeta | undefined;
                      const isLastBodyCell = cellIndex === visibleCells.length - 1;
                      const isActions = cell.column.id === "actions";
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-2 py-2 align-top",
                            !isLastBodyCell && "border-r border-border/50",
                            !isActions && "max-w-0",
                            cmeta?.align === "right"
                              ? "text-right"
                              : cmeta?.align === "center"
                                ? "text-center"
                                : "text-left",
                          )}
                          style={{ width: cell.column.getSize(), minWidth: cell.column.columnDef.minSize }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
