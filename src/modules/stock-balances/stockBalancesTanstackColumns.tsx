import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { StockBalanceCoverageStatus } from "@/shared/stockBalancesOperationalMetrics";
import { stockCoverageToPillTone } from "@/shared/ui/ag-grid/gridOutlinePillMapping";
import { GridOutlinePillBadge } from "@/shared/ui/ag-grid/GridOutlinePillBadge";
import type { StockStyle } from "@/shared/inventoryStyle";
import type { StockBalanceListRow } from "./stockBalanceListRowModel";
import type { StockBalancesTableColumnSchema } from "./stockBalancesTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

export type FormatStockBalancesNumber = (
  value: number,
  opts?: { minFractionDigits?: number; maxFractionDigits?: number },
) => string;

export type BuildStockBalancesTanstackColumnsInput = {
  schema: StockBalancesTableColumnSchema[];
  t: TFunction;
  formatNumber: FormatStockBalancesNumber;
  styleLabel: (s: StockStyle) => string;
  coverageLabel: (s: StockBalanceCoverageStatus) => string;
};

const columnHelper = createColumnHelper<StockBalanceListRow>();

export function formatStockBalancesTableValue(input: {
  column: StockBalancesTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatNumber: FormatStockBalancesNumber;
  styleLabel: (s: StockStyle) => string;
  coverageLabel: (s: StockBalanceCoverageStatus) => string;
  rowIndex?: number;
}): string {
  const { column, value, formatNumber, styleLabel, coverageLabel, rowIndex } = input;

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "integer-qty") {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return formatNumber(value, { minFractionDigits: 0, maxFractionDigits: 0 });
    }
    return "—";
  }

  if (column.formatKind === "stock-style") {
    if (value == null) return "—";
    return styleLabel(value as StockStyle);
  }

  if (column.formatKind === "coverage-label") {
    if (value == null) return "—";
    return coverageLabel(value as StockBalanceCoverageStatus);
  }

  if (value == null) return "";
  if (typeof value === "boolean") return value ? input.t("common.yes") : input.t("common.no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function getColumnAlign(column: StockBalancesTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildStockBalancesTanstackColumns(
  input: BuildStockBalancesTanstackColumnsInput,
): ColumnDef<StockBalanceListRow>[] {
  const { schema, t, formatNumber, styleLabel, coverageLabel } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = { align: getColumnAlign(column) };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatStockBalancesTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            formatNumber,
            styleLabel,
            coverageLabel,
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

    if (column.id === "coverageStatus") {
      return columnHelper.accessor("coverageStatus", {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const raw = ctx.getValue() as StockBalanceCoverageStatus | undefined;
          if (raw == null) return <span className="text-muted-foreground">—</span>;
          return (
            <GridOutlinePillBadge tone={stockCoverageToPillTone(raw)} className="max-w-full">
              {coverageLabel(raw)}
            </GridOutlinePillBadge>
          );
        },
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "style") {
      return columnHelper.accessor("style", {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const v = ctx.getValue() as StockStyle | undefined;
          const text = v != null ? styleLabel(v) : "—";
          return <span className="tabular-nums">{text}</span>;
        },
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.formatKind === "integer-qty") {
      const key = (column.accessorKey ?? column.id) as keyof StockBalanceListRow;
      return columnHelper.accessor(key, {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const v = ctx.getValue();
          const text =
            typeof v === "number" && !Number.isNaN(v)
              ? formatNumber(v, { minFractionDigits: 0, maxFractionDigits: 0 })
              : "—";
          return <span className="tabular-nums">{text}</span>;
        },
        sortingFn: "basic",
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return columnHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? column.id) as keyof StockBalanceListRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatStockBalancesTableValue({
            column,
            value: ctx.getValue(),
            t,
            formatNumber,
            styleLabel,
            coverageLabel,
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
  }) as ColumnDef<StockBalanceListRow>[];
}
