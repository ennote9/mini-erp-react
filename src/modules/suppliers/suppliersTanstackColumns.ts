import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { SupplierListRow } from "./supplierListRowModel";
import type { SuppliersTableColumnSchema } from "./suppliersTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

type BuildSuppliersTanstackColumnsInput = {
  schema: SuppliersTableColumnSchema[];
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

const columnHelper = createColumnHelper<SupplierListRow>();

function emDashLabel(t: TFunction): string {
  return t("domain.audit.summary.emDash");
}

export function formatSuppliersTableValue(input: {
  column: SuppliersTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  rowIndex?: number;
}): string {
  const { column, value, t, formatMoney, rowIndex } = input;
  const em = emDashLabel(t);

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "optional-text") {
    if (value == null || value === "") return em;
    return String(value);
  }

  if (column.formatKind === "payment-terms-days") {
    if (value != null && typeof value === "number") {
      return t("doc.summary.paymentTermsDays", { days: value });
    }
    return em;
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

function getColumnAlign(column: SuppliersTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildSuppliersTanstackColumns(
  input: BuildSuppliersTanstackColumnsInput,
): ColumnDef<SupplierListRow, any>[] {
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
          formatSuppliersTableValue({
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
        formatSuppliersTableValue({
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
