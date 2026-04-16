import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import { normalizeDateForSO } from "./dateUtils";
import type { SalesOrderListRow } from "./salesOrderListRowModel";
import type { SalesOrdersTableColumnSchema } from "./salesOrdersTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

export type BuildSalesOrdersTanstackColumnsInput = {
  schema: SalesOrdersTableColumnSchema[];
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
};

const columnHelper = createColumnHelper<SalesOrderListRow>();

export function formatSalesOrdersTableValue(input: {
  column: SalesOrdersTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  rowIndex?: number;
}): string {
  const { column, value, t, formatDate, rowIndex } = input;

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "so-date") {
    const raw = value == null ? undefined : String(value);
    return formatDate(normalizeDateForSO(raw), { empty: "" });
  }

  if (column.formatKind === "planning-status") {
    if (value == null || value === "") return "";
    return t(`status.labels.${String(value)}`);
  }

  if (value == null) return "";
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function getColumnAlign(column: SalesOrdersTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildSalesOrdersTanstackColumns(
  input: BuildSalesOrdersTanstackColumnsInput,
): ColumnDef<SalesOrderListRow>[] {
  const { schema, t, formatDate } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = {
      align: getColumnAlign(column),
    };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatSalesOrdersTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            formatDate,
            rowIndex: ctx.row.index,
          }),
        enableSorting: false,
        enableHiding: false,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return columnHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? "number") as keyof SalesOrderListRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatSalesOrdersTableValue({
            column,
            value: ctx.getValue(),
            t,
            formatDate,
            rowIndex: ctx.row.index,
          }),
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      },
    );
  });
}
