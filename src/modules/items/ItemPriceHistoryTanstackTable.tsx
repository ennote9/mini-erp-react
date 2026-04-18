import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Funnel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n";
import type { PriceHistoryRow } from "./lib/itemPriceHistory";
import type { ItemPriceHistoryColumnSchema } from "./itemPriceHistoryTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

const columnHelper = createColumnHelper<PriceHistoryRow>();

const MIN_TABLE_WIDTH_PX = 640;

/** Last-resort floor when the card is narrower than soft minimums (shrink high–flex columns first). */
const ABS_MIN_WIDTH_BY_ID: Record<string, number> = {
  priceType: 64,
  amount: 64,
  validFrom: 78,
  validTo: 78,
  status: 88,
  reasonCode: 92,
  comment: 72,
  createdAt: 104,
};

/**
 * Fits columns to `targetWidth` with no horizontal overflow: soft mins first, remainder by flexWeight
 * (comment + reason absorb extra; under budget, shrink from highest flex first).
 */
function computeFlexColumnWidths(
  leafColumns: Column<PriceHistoryRow, unknown>[],
  targetWidth: number,
  getSoftMin: (id: string) => number,
  getFlexWeight: (id: string) => number,
): number[] {
  const n = leafColumns.length;
  if (n === 0 || targetWidth <= 0) return [];

  const ids = leafColumns.map((c) => c.id);
  const softMins = ids.map((id) => getSoftMin(id));
  const flexW = ids.map((id) => getFlexWeight(id));
  const absMins = ids.map((id) => ABS_MIN_WIDTH_BY_ID[id] ?? 52);

  let w = softMins.slice();
  let sumW = w.reduce((a, b) => a + b, 0);

  if (sumW > targetWidth) {
    let guard = 0;
    while (sumW > targetWidth && guard < 10000) {
      guard++;
      let bestI = -1;
      let bestFlex = -Infinity;
      for (let i = 0; i < n; i++) {
        if (w[i]! <= absMins[i]!) continue;
        if (flexW[i]! > bestFlex) {
          bestFlex = flexW[i]!;
          bestI = i;
        }
      }
      if (bestI < 0) break;
      w[bestI]!--;
      sumW--;
    }
    return w;
  }

  let rem = targetWidth - sumW;
  const totalFlex = flexW.reduce((a, b) => a + b, 0);
  if (totalFlex <= 0) {
    let i = 0;
    while (rem > 0) {
      w[i % n]!++;
      rem--;
      i++;
    }
    return w;
  }

  const add = flexW.map((fw) => (rem * fw) / totalFlex);
  for (let i = 0; i < n; i++) w[i] += Math.floor(add[i]!);
  rem = targetWidth - w.reduce((a, b) => a + b, 0);
  const order = ids.map((_, i) => i).sort((a, b) => flexW[b]! - flexW[a]!);
  let idx = 0;
  while (rem > 0) {
    w[order[idx % n]!]!++;
    rem--;
    idx++;
  }
  return w;
}

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
  } = props;

  const schemaById = useMemo(() => new Map(schema.map((c) => [c.id, c])), [schema]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const measureContainer = useMemo(
    () => () => {
      const el = containerRef.current;
      if (!el) return;
      const w = Math.round(el.getBoundingClientRect().width);
      setContainerWidth((prev) => (prev !== w ? w : prev));
    },
    [],
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measureContainer();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureContainer());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureContainer, rows.length, schema.length, sorting]);

  const columns = useMemo(() => {
    const defs: ColumnDef<PriceHistoryRow, unknown>[] = [];

    for (const col of schema) {
      const meta: ColumnMeta = { align: col.align };

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
  }, [schema, t, formatMoney, reasonLabel, statusLabel]);

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
  const availableWidth = containerWidth > 0 ? containerWidth : MIN_TABLE_WIDTH_PX;
  const tableDisplayWidth = availableWidth;

  const columnWidthsById = new Map<string, number>();

  if (visibleLeafColumns.length > 0) {
    const widths = computeFlexColumnWidths(
      visibleLeafColumns,
      tableDisplayWidth,
      (id) => schemaById.get(id)?.minSize ?? 64,
      (id) => schemaById.get(id)?.flexWeight ?? 1,
    );
    const sumW = widths.reduce((a, b) => a + b, 0);
    if (widths.length > 0 && sumW !== tableDisplayWidth) {
      widths[widths.length - 1]! += tableDisplayWidth - sumW;
    }
    visibleLeafColumns.forEach((c, idx) => {
      columnWidthsById.set(c.id, widths[idx]!);
    });
  } else {
    visibleLeafColumns.forEach((c) => columnWidthsById.set(c.id, c.getSize()));
  }

  const cellWidth = (columnId: string, fallback: number) => columnWidthsById.get(columnId) ?? fallback;
  const colPercent = (columnId: string, fallback: number) =>
    tableDisplayWidth > 0 ? `${(cellWidth(columnId, fallback) / tableDisplayWidth) * 100}%` : undefined;

  return (
    <div
      ref={containerRef}
      className="min-w-0 w-full overflow-hidden rounded-lg border border-border/60 bg-card/20 shadow-sm"
      data-testid="item-prices-history-table"
    >
      <div className="max-h-[380px] overflow-y-auto overflow-x-hidden overscroll-contain">
        <table className="w-full min-w-0 table-fixed border-collapse text-xs leading-tight">
          <colgroup>
            {visibleLeafColumns.map((column) => (
              <col key={column.id} style={{ width: colPercent(column.id, column.getSize()) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[2] bg-card text-[11px] shadow-[0_1px_0_0_hsl(var(--border))]">
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
                        "group relative h-9 max-h-9 select-none whitespace-nowrap px-2 align-middle py-1.5",
                        !isLastHeaderCell && "border-r border-border/50",
                        meta?.align === "right"
                          ? "text-right"
                          : meta?.align === "center"
                            ? "text-center"
                            : "text-left",
                      )}
                      style={{
                        width: colPercent(header.column.id, header.getSize()),
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex min-w-0 items-center gap-1",
                            meta?.align === "right" && "justify-end",
                            meta?.align === "center" && "justify-center",
                          )}
                        >
                          {canSort ? (
                            <button
                              type="button"
                              data-testid={`item-prices-history-sort-${header.column.id}`}
                              className={cn(
                                "flex min-h-0 min-w-0 max-w-full items-center gap-1 rounded-sm px-0.5 py-0.5 text-left text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                meta?.align === "right" && "justify-end text-right",
                                meta?.align === "center" && "justify-center text-center",
                              )}
                              title={String(header.column.columnDef.header ?? "")}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="shrink-0 whitespace-nowrap">
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
                                "flex min-h-0 items-center px-0.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground",
                                meta?.align === "right" && "justify-end text-right",
                                meta?.align === "center" && "justify-center text-center",
                              )}
                            >
                              <span className="shrink-0 whitespace-nowrap">
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
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "py-2.5 align-top px-2",
                            !isLastBodyCell && "border-r border-border/50",
                            "max-w-0",
                            cmeta?.align === "right"
                              ? "text-right"
                              : cmeta?.align === "center"
                                ? "text-center"
                                : "text-left",
                          )}
                          style={{
                            width: colPercent(cell.column.id, cell.column.getSize()),
                          }}
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

