import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type Table,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/shared/i18n/resolve";
import { PO_LINES_TANSTACK_SELECT_COLUMN_ID } from "../purchaseOrderLinesTanstackColumns";

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

export type PurchaseOrderLinesTanstackTableProps<TData> = {
  rows: TData[];
  /** Data columns only; select column is injected when `enableRowSelection` is true. */
  dataColumns: ColumnDef<TData, unknown>[];
  getRowId: (row: TData) => string;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowClassName?: (row: TData) => string | undefined;
  /** When row selection is enabled, used for checkbox row aria-labels (typically item code). */
  resolveRowSelectLabel?: (row: TData) => string;
  t: TFunction;
  className?: string;
};

export function PurchaseOrderLinesTanstackTable<TData>(props: PurchaseOrderLinesTanstackTableProps<TData>) {
  const {
    rows,
    dataColumns,
    getRowId,
    columnSizing,
    onColumnSizingChange,
    enableRowSelection = false,
    rowSelection,
    onRowSelectionChange,
    getRowClassName,
    resolveRowSelectLabel,
    t,
    className,
  } = props;

  const columns = useMemo(() => {
    if (!enableRowSelection) return dataColumns;

    const selectColumn: ColumnDef<TData, unknown> = {
      id: PO_LINES_TANSTACK_SELECT_COLUMN_ID,
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
      cell: ({ row }) => {
        const label = resolveRowSelectLabel?.(row.original) ?? row.id;
        return (
          <div
            className="flex w-full items-center justify-center"
            data-po-line-select-cell
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Checkbox
              aria-label={t("doc.list.rowSelectRowAria", { code: String(label) })}
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
        );
      },
    };

    return [selectColumn, ...dataColumns];
  }, [dataColumns, enableRowSelection, resolveRowSelectLabel, t]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    enableRowSelection,
    enableMultiRowSelection: enableRowSelection,
    state: {
      columnSizing,
      ...(enableRowSelection ? { rowSelection: rowSelection ?? {} } : {}),
    },
    onColumnSizingChange,
    ...(enableRowSelection && onRowSelectionChange ? { onRowSelectionChange } : {}),
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = table.getTotalSize();
  const resizeGuideLeftPx = getColumnResizeGuideLeftPx(table);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-md border border-border bg-background text-[12px] leading-tight",
        className,
      )}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="relative inline-block align-top" style={{ width: totalWidth }}>
          {resizeGuideLeftPx != null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-[20] w-px bg-border/80"
              style={{ left: resizeGuideLeftPx }}
            />
          ) : null}
          <table className="w-full border-collapse table-fixed" style={{ width: totalWidth }}>
            <colgroup>
              {visibleLeafColumns.map((column) => (
                <col key={column.id} style={{ width: column.getSize() }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { align?: "left" | "right" | "center" } | undefined;
                    const isLastHeaderCell = header.index === headerGroup.headers.length - 1;
                    const isSelectHeader = header.column.id === PO_LINES_TANSTACK_SELECT_COLUMN_ID;
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
                            (meta?.align === "right"
                              ? "text-right"
                              : meta?.align === "center"
                                ? "text-center"
                                : "text-left"),
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
                  const extraClass = getRowClassName?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        enableRowSelection && "cursor-pointer hover:bg-muted/40",
                        !enableRowSelection && "cursor-default",
                        row.getIsSelected() && "bg-muted/25",
                        extraClass,
                      )}
                      onClick={
                        enableRowSelection
                          ? (event) => {
                              const target = event.target as HTMLElement;
                              if (target.closest("[data-po-line-select-cell]")) return;
                              const handler = row.getToggleSelectedHandler();
                              handler(event);
                            }
                          : undefined
                      }
                    >
                      {visibleCells.map((cell, cellIndex) => {
                        const cellMeta = cell.column.columnDef.meta as
                          | { align?: "left" | "right" | "center" }
                          | undefined;
                        const isLastBodyCell = cellIndex === visibleCells.length - 1;
                        const isSelectCell = cell.column.id === PO_LINES_TANSTACK_SELECT_COLUMN_ID;
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
                                (cellMeta?.align === "right"
                                  ? "text-right tabular-nums"
                                  : cellMeta?.align === "center"
                                    ? "text-center"
                                    : "text-left"),
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
