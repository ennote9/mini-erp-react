import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Funnel } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n";
import type { PriceHistoryRow } from "./lib/itemPriceHistory";
import type { ItemPriceHistoryColumnSchema } from "./itemPriceHistoryTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

const columnHelper = createColumnHelper<PriceHistoryRow>();

function getColumnResizeGuideLeftPx<T>(table: Table<T>): number | null {
  const info = table.getState().columnSizingInfo;
  const columnId = info.isResizingColumn;
  if (!columnId || typeof columnId !== "string" || info.columnSizingStart.length === 0) {
    return null;
  }

  const headerGroup = table.getHeaderGroups()[0];
  if (!headerGroup) return null;

  const header = headerGroup.headers.find((h) => h.column.id === columnId);
  if (!header) return null;

  const startPair = info.columnSizingStart.find(([id]) => id === columnId);
  if (!startPair) return null;

  const [, startW] = startPair;
  if (startW <= 0) return null;

  const deltaP = info.deltaPercentage ?? 0;
  const rawNew = startW + startW * deltaP;
  const min = header.column.columnDef.minSize ?? 20;
  const max = header.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
  const newW = Math.min(Math.max(Math.round(rawNew * 100) / 100, min), max);

  return header.getStart() + newW;
}

type Props = {
  rows: PriceHistoryRow[];
  schema: ItemPriceHistoryColumnSchema[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  onHeaderFilterClick?: (fieldId: string, anchorRect: { left: number; top: number; width: number; height: number }) => void;
  headerFilterState?: Record<string, boolean>;
  openHeaderFilterFieldId?: string | null;
  t: TFunction;
  formatMoney: (n: number | undefined) => string;
  reasonLabel: (code: string) => string;
  statusLabel: (status: PriceHistoryRow["status"]) => string;
  className?: string;
};

export function ItemPriceHistoryTanstackTable(props: Props) {
  const {
    rows,
    schema,
    sorting,
    onSortingChange,
    columnSizing,
    onColumnSizingChange,
    onHeaderFilterClick,
    headerFilterState,
    openHeaderFilterFieldId,
    t,
    formatMoney,
    reasonLabel,
    statusLabel,
    className,
  } = props;

  const schemaById = useMemo(() => new Map(schema.map((c) => [c.id, c])), [schema]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      setViewportWidth((prev) => (prev !== w ? w : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length, schema.length]);

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
            maxSize: col.maxSize ?? 1200,
            meta,
            cell: ({ row }) => {
              const r = row.original;
              switch (col.id) {
                case "priceType":
                  return r.priceType === "purchase"
                    ? t("master.item.prices.typePurchase")
                    : t("master.item.prices.typeSale");
                case "amount":
                  return formatMoney(r.amount);
                case "validFrom":
                  return r.validFrom;
                case "validTo":
                  return r.validTo ?? "—";
                case "status":
                  return statusLabel(r.status);
                case "reasonCode":
                  return reasonLabel(r.reasonCode);
                case "comment":
                  return r.comment ?? "—";
                case "createdAt":
                  return r.createdAt.slice(0, 19).replace("T", " ");
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
    getRowId: (row) => row.id,
    manualSorting: true,
    columnResizeMode: "onEnd",
    enableColumnResizing: true,
    enableMultiSort: true,
    state: { sorting, columnSizing },
    onSortingChange,
    onColumnSizingChange,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = table.getTotalSize();
  const resizeGuideLeftPx = getColumnResizeGuideLeftPx(table);

  /** Fill workspace width when columns are narrower than the scroll viewport (like a full-width grid). */
  const layoutWidth = Math.max(totalWidth, viewportWidth || 0);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-md border border-border bg-background",
        className,
      )}
      data-testid="item-prices-history-table"
    >
      <div
        ref={scrollRef}
        className="erp-dark-scrollbar min-h-0 min-w-0 w-full flex-1 overflow-auto"
        data-item-prices-history-scroll
      >
        <div className="relative inline-block min-w-full align-top" style={{ width: layoutWidth || undefined }}>
          {resizeGuideLeftPx != null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-[20] w-px bg-border/80"
              style={{ left: resizeGuideLeftPx }}
            />
          ) : null}
          <table
            className="w-full border-collapse table-fixed text-[12px] leading-tight"
            style={{ width: layoutWidth || totalWidth }}
          >
            <colgroup>
              {visibleLeafColumns.map((column) => (
                <col key={column.id} style={{ width: column.getSize() }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
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
                          "group relative h-7 select-none bg-background px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
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
                                  "flex min-w-0 flex-1 items-center gap-0.5 rounded-sm px-1 py-px leading-none text-left text-inherit transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
                                  "flex min-w-0 flex-1 items-center px-1 py-px leading-none",
                                  meta?.align === "right" && "justify-end",
                                  meta?.align === "center" && "justify-center",
                                )}
                                title={String(header.column.columnDef.header ?? "")}
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
                                  "relative z-10 shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
                        {header.column.getCanResize() ? (
                          <div
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              header.column.resetSize();
                            }}
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              header.getResizeHandler()(event);
                            }}
                            onTouchStart={(event) => {
                              event.stopPropagation();
                              header.getResizeHandler()(event);
                            }}
                            className="absolute right-0 top-0 z-[1] h-full w-2 cursor-col-resize select-none touch-none"
                            aria-hidden
                          />
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-[12px] text-muted-foreground"
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
                      className="border-b border-border/60 transition-colors hover:bg-muted/40"
                    >
                      {visibleCells.map((cell, cellIndex) => {
                        const cmeta = cell.column.columnDef.meta as ColumnMeta | undefined;
                        const isLastBodyCell = cellIndex === visibleCells.length - 1;
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-2 py-0.5 text-foreground/95",
                              "truncate",
                              !isLastBodyCell && "border-r border-border/50",
                              cmeta?.align === "right"
                                ? "text-right tabular-nums"
                                : cmeta?.align === "center"
                                  ? "text-center"
                                  : "text-left",
                            )}
                            style={{ width: cell.column.getSize(), minWidth: cell.column.columnDef.minSize }}
                            title={String(cell.getValue() ?? "")}
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
    </div>
  );
}
