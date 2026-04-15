import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { BrandListRow } from "./brandListRowModel";
import type { BrandsTableColumnSchema } from "./brandsTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

type BuildBrandsTanstackColumnsInput = {
  schema: BrandsTableColumnSchema[];
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

const columnHelper = createColumnHelper<BrandListRow>();

export function formatBrandsTableValue(input: {
  column: BrandsTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  rowIndex?: number;
}): string {
  const { column, value, t, formatMoney, rowIndex } = input;
  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.id === "comment") {
    if (value == null || value === "") return "—";
    return String(value);
  }

  if (value == null) return "";
  if (column.formatKind === "yes-no") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  void formatMoney;
  return String(value);
}

function getColumnAlign(column: BrandsTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  return "left";
}

export function buildBrandsTanstackColumns(
  input: BuildBrandsTanstackColumnsInput,
): ColumnDef<BrandListRow, any>[] {
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
          formatBrandsTableValue({
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
        formatBrandsTableValue({
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
