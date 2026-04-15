import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
import type { RefObject } from "react";
import { useMemo } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Funnel } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n";
import type { ItemListRow } from "./listViewRowModel";
import type { ItemsTableColumnSchema } from "./itemsTableSchema";
import { buildItemsTanstackColumns } from "./itemsTanstackColumns";

/**
 * Right edge of the resized column in table coordinates, from TanStack's transient
 * `columnSizingInfo` (updated during drag even when `columnResizeMode` is `onEnd`).
 */
function getColumnResizeGuideLeftPx(table: Table<ItemListRow>): number | null {
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

/** Synthetic TanStack column id — not part of persisted schema / sizing keys. */
const ITEMS_TABLE_SELECT_COLUMN_ID = "__rowSelect__";

type ItemsTanstackTableProps = {
  rows: ItemListRow[];
  schema: ItemsTableColumnSchema[];
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  columnSizing: ColumnSizingState;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onSortingChange: OnChangeFn<SortingState>;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  onRowClick: (row: ItemListRow) => void;
  onHeaderFilterClick?: (fieldId: string, anchorRect: { left: number; top: number; width: number; height: number }) => void;
  headerFilterState?: Record<string, boolean>;
  openHeaderFilterFieldId?: string | null;
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
    rowSelection,
    onRowSelectionChange,
    onSortingChange,
    onColumnSizingChange,
    onRowClick,
    onHeaderFilterClick,
    headerFilterState,
    openHeaderFilterFieldId,
    t,
    formatMoney,
    className,
    scrollContainerRef,
  } = props;

  const columnOrderWithSelect = useMemo(
    () => [ITEMS_TABLE_SELECT_COLUMN_ID, ...columnOrder.filter((id) => id !== ITEMS_TABLE_SELECT_COLUMN_ID)],
    [columnOrder],
  );

  const columns = useMemo(() => {
    const selectColumn: ColumnDef<ItemListRow, unknown> = {
      id: ITEMS_TABLE_SELECT_COLUMN_ID,
      size: 38,
      minSize: 36,
      maxSize: 44,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      meta: { align: "center" as const },
      header: ({ table }) => (
        <div
          className="flex w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            aria-label={t("doc.list.rowSelectAllPageAria")}
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onCheckedChange={(value) => {
              if (value === "indeterminate") return;
              table.toggleAllPageRowsSelected(value === true);
            }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            aria-label={t("doc.list.rowSelectRowAria", { code: row.original.code })}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onCheckedChange={(value) => {
              if (value === "indeterminate") return;
              row.toggleSelected(value === true);
            }}
          />
        </div>
      ),
    };

    return [selectColumn, ...buildItemsTanstackColumns({ schema, t, formatMoney })];
  }, [schema, t, formatMoney]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    manualSorting: true,
    columnResizeMode: "onEnd",
    enableMultiSort: true,
    state: {
      sorting,
      columnVisibility,
      columnOrder: columnOrderWithSelect,
      columnSizing,
      rowSelection,
    },
    onSortingChange,
    onColumnSizingChange,
    onRowSelectionChange,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = table.getTotalSize();
  const schemaById = useMemo(
    () => new Map(schema.map((column) => [column.id, column])),
    [schema],
  );

  const resizeGuideLeftPx = getColumnResizeGuideLeftPx(table);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col rounded-md border border-border bg-background",
        className,
      )}
    >
      <div
        ref={scrollContainerRef}
        className="min-h-0 min-w-0 flex-1 overflow-auto"
        data-items-table-scroll
      >
        <div className="relative inline-block align-top" style={{ width: Math.max(totalWidth, 960) }}>
          {resizeGuideLeftPx != null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-[20] w-px bg-border/80"
              style={{ left: resizeGuideLeftPx }}
            />
          ) : null}
          <table
            className="w-full border-collapse table-fixed text-[12px] leading-tight"
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
                  const isOpenFilterField = openHeaderFilterFieldId === header.column.id;
                  const isLastHeaderCell = header.index === headerGroup.headers.length - 1;
                  const isSelectHeader = header.column.id === ITEMS_TABLE_SELECT_COLUMN_ID;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "group relative h-7 select-none bg-background",
                        isSelectHeader
                          ? "px-0 py-0 font-normal normal-case tracking-normal text-foreground"
                          : "px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                        !isLastHeaderCell && "border-r border-border/50",
                        !isSelectHeader &&
                          (meta?.align === "right" ? "text-right" : meta?.align === "center" ? "text-center" : "text-left"),
                        isSelectHeader && "text-center",
                      )}
                      style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize }}
                    >
                      {header.isPlaceholder ? null : isSelectHeader ? (
                        <div
                          className="flex h-full w-full items-center justify-center px-1.5"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-center gap-0.5">
                          {canSort ? (
                            <button
                              type="button"
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
                                "shrink-0 rounded-sm p-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                hasActiveFilter
                                  ? "text-primary opacity-100"
                                  : isOpenFilterField
                                    ? "text-muted-foreground/70 opacity-100"
                                    : "pointer-events-none text-muted-foreground/70 opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
                              )}
                              aria-label={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
                              title={`${t("doc.list.viewTabFiltering")}: ${schemaColumn?.label ?? header.column.id}`}
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
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40",
                    row.getIsSelected() && "bg-muted/25",
                  )}
                  onClick={() => onRowClick(row.original)}
                >
                  {visibleCells.map((cell, cellIndex) => {
                    const meta = cell.column.columnDef.meta as { align?: "left" | "right" | "center" } | undefined;
                    const isLastBodyCell = cellIndex === visibleCells.length - 1;
                    const isSelectCell = cell.column.id === ITEMS_TABLE_SELECT_COLUMN_ID;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2 py-0.5 text-foreground/95",
                          isSelectCell
                            ? "overflow-visible px-1.5 text-center"
                            : "truncate",
                          !isLastBodyCell && "border-r border-border/50",
                          !isSelectCell &&
                            (meta?.align === "right" ? "text-right tabular-nums" : meta?.align === "center" ? "text-center" : "text-left"),
                        )}
                        style={{ width: cell.column.getSize(), minWidth: cell.column.columnDef.minSize }}
                        title={isSelectCell ? undefined : String(cell.getValue() ?? "")}
                        onClick={isSelectCell ? (event) => event.stopPropagation() : undefined}
                        onPointerDown={isSelectCell ? (event) => event.stopPropagation() : undefined}
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
