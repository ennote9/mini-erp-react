import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnSizingState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import type { RefObject } from "react";
import { useMemo } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Funnel } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n";
import type { ItemListRow } from "./listViewRowModel";
import type { ItemsTableColumnSchema } from "./itemsTableSchema";
import { buildItemsTanstackColumns } from "./itemsTanstackColumns";

type ItemsTanstackTableProps = {
  rows: ItemListRow[];
  schema: ItemsTableColumnSchema[];
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  columnSizing: ColumnSizingState;
  onSortingChange: OnChangeFn<SortingState>;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  onRowClick: (row: ItemListRow) => void;
  onHeaderFilterClick?: (fieldId: string, anchorRect: { left: number; top: number; height: number }) => void;
  headerFilterState?: Record<string, boolean>;
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

export function ItemsTanstackTable(props: ItemsTanstackTableProps) {
  const {
    rows,
    schema,
    sorting,
    columnVisibility,
    columnOrder,
    columnSizing,
    onSortingChange,
    onColumnSizingChange,
    onRowClick,
    onHeaderFilterClick,
    headerFilterState,
    t,
    formatMoney,
    className,
    scrollContainerRef,
  } = props;

  const columns = useMemo(
    () => buildItemsTanstackColumns({ schema, t, formatMoney }),
    [schema, t, formatMoney],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    columnResizeMode: "onEnd",
    enableMultiSort: true,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      columnSizing,
    },
    onSortingChange,
    onColumnSizingChange,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = table.getTotalSize();
  const schemaById = useMemo(
    () => new Map(schema.map((column) => [column.id, column])),
    [schema],
  );

  return (
    <div
      className={cn(
        "min-h-0 rounded-md border border-border bg-background",
        className,
      )}
    >
      <div ref={scrollContainerRef} className="overflow-auto" data-items-table-scroll>
        <table
          className="w-full border-collapse table-fixed text-sm"
          style={{ width: Math.max(totalWidth, 960) }}
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
                  const meta = header.column.columnDef.meta as { align?: "left" | "right" | "center" } | undefined;
                  const schemaColumn = schemaById.get(header.column.id);
                  const canFilter = schemaColumn?.filterable === true;
                  const hasActiveFilter = headerFilterState?.[header.column.id] === true;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "group relative h-10 select-none bg-background px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                        meta?.align === "right" ? "text-right" : meta?.align === "center" ? "text-center" : "text-left",
                      )}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {canSort ? (
                            <button
                              type="button"
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1 py-1 text-left text-inherit transition-colors hover:bg-muted/60",
                                meta?.align === "right" && "justify-end",
                                meta?.align === "center" && "justify-center",
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="truncate">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                              {sortState === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                              ) : sortState === "desc" ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-45" />
                              )}
                            </button>
                          ) : (
                            <div
                              className={cn(
                                "flex min-w-0 flex-1 items-center px-1 py-1",
                                meta?.align === "right" && "justify-end",
                                meta?.align === "center" && "justify-center",
                              )}
                            >
                              <span className="truncate">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                            </div>
                          )}
                          {canFilter ? (
                            <button
                              type="button"
                              className={cn(
                                "shrink-0 rounded-sm p-1 transition-colors hover:bg-muted/60",
                                hasActiveFilter ? "text-primary" : "text-muted-foreground/70",
                              )}
                              aria-label={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
                              title={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                onHeaderFilterClick?.(header.column.id, {
                                  left: rect.left,
                                  top: rect.top,
                                  height: rect.height,
                                });
                              }}
                            >
                              <Funnel className={cn("h-3.5 w-3.5", hasActiveFilter && "fill-current")} />
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
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <div className="mx-auto h-full w-px bg-border/80" />
                        </div>
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
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                  colSpan={visibleLeafColumns.length || 1}
                >
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: "left" | "right" | "center" } | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "truncate px-3 py-2.5 text-sm text-foreground/95",
                          meta?.align === "right" ? "text-right tabular-nums" : meta?.align === "center" ? "text-center" : "text-left",
                        )}
                        style={{ width: cell.column.getSize(), minWidth: cell.column.columnDef.minSize }}
                        title={String(cell.getValue() ?? "")}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
