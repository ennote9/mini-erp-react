import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { ItemListRow } from "./listViewRowModel";
import type { ItemsTableColumnSchema } from "./itemsTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

type BuildItemsTanstackColumnsInput = {
  schema: ItemsTableColumnSchema[];
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

const columnHelper = createColumnHelper<ItemListRow>();

export function formatItemsTableValue(input: {
  column: ItemsTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  rowIndex?: number;
}): string {
  const { column, value, t, formatMoney, rowIndex } = input;
  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (value == null) return "";
  if (column.formatKind === "money") {
    return typeof value === "number" ? formatMoney(value, 2, "") : "";
  }
  if (column.formatKind === "yes-no") {
    return value ? t("common.yes") : t("common.no");
  }
  if (column.formatKind === "item-kind") {
    return value === "TESTER" ? t("master.item.kind.tester") : t("master.item.kind.sellable");
  }
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function getColumnAlign(column: ItemsTableColumnSchema): ColumnMeta["align"] {
  if (column.rendererType === "numeric") return "right";
  if (column.id === "lineNo") return "right";
  return "left";
}

export function buildItemsTanstackColumns(
  input: BuildItemsTanstackColumnsInput,
): ColumnDef<ItemListRow, any>[] {
  const { schema, t, formatMoney } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = {
      align: getColumnAlign(column),
    };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatItemsTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            formatMoney,
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

    return columnHelper.accessor((row) => row[column.accessorKey ?? "code"], {
      id: column.id,
      header: column.label,
      cell: (ctx) =>
        formatItemsTableValue({
          column,
          value: ctx.getValue(),
          t,
          formatMoney,
          rowIndex: ctx.row.index,
        }),
      enableSorting: column.sortable,
      enableHiding: !column.lockedVisible,
      size: column.defaultSize,
      minSize: column.minSize,
      maxSize: column.maxSize,
      meta,
    });
  });
}
