import { Link } from "react-router-dom";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import { movementTypeToPillTone } from "@/shared/ui/ag-grid/gridOutlinePillMapping";
import { GridOutlinePillBadge } from "@/shared/ui/ag-grid/GridOutlinePillBadge";
import type { StockMovementListRow } from "./movementListRowModel";
import type { MovementsTableColumnSchema } from "./movementsTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

export type FormatMovementDateTime = (
  value: string | null | undefined,
  options?: { empty?: string },
) => string;

export type FormatMovementQtyDelta = (value: number | null | undefined) => string;

export type BuildMovementsTanstackColumnsInput = {
  schema: MovementsTableColumnSchema[];
  t: TFunction;
  formatDateTimeUi: FormatMovementDateTime;
  formatQtyDeltaUi: FormatMovementQtyDelta;
  movementTypeLabel: (code: string) => string;
};

const columnHelper = createColumnHelper<StockMovementListRow>();

export function formatMovementsTableValue(input: {
  column: MovementsTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatDateTimeUi: FormatMovementDateTime;
  formatQtyDeltaUi: FormatMovementQtyDelta;
  movementTypeLabel: (code: string) => string;
  rowIndex?: number;
}): string {
  const { column, value, formatDateTimeUi, formatQtyDeltaUi, movementTypeLabel, rowIndex } = input;

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "movement-datetime") {
    return formatDateTimeUi(value == null ? undefined : String(value), { empty: "" });
  }

  if (column.formatKind === "movement-type-label") {
    if (value == null || value === "") return "";
    return movementTypeLabel(String(value));
  }

  if (column.formatKind === "qty-delta") {
    return formatQtyDeltaUi(value as number | null | undefined);
  }

  if (value == null) return "";
  if (typeof value === "boolean") return value ? input.t("common.yes") : input.t("common.no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function getColumnAlign(column: MovementsTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildMovementsTanstackColumns(
  input: BuildMovementsTanstackColumnsInput,
): ColumnDef<StockMovementListRow>[] {
  const { schema, t, formatDateTimeUi, formatQtyDeltaUi, movementTypeLabel } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = { align: getColumnAlign(column) };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatMovementsTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            formatDateTimeUi,
            formatQtyDeltaUi,
            movementTypeLabel,
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

    if (column.id === "datetime") {
      return columnHelper.accessor("datetime", {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span className="tabular-nums">
            {formatDateTimeUi(ctx.getValue() as string | undefined, { empty: "" })}
          </span>
        ),
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "movementType") {
      return columnHelper.accessor("movementType", {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const raw = ctx.getValue() as string | undefined;
          if (raw == null) return null;
          const key = `ops.stockMovements.types.${raw}`;
          const translated = t(key);
          const label = translated === raw ? raw : translated;
          return (
            <GridOutlinePillBadge tone={movementTypeToPillTone(raw)} className="max-w-full">
              {label}
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

    if (column.id === "qtyDelta") {
      return columnHelper.accessor("qtyDelta", {
        id: column.id,
        header: column.label,
        cell: (ctx) => (
          <span className="tabular-nums">{formatQtyDeltaUi(ctx.getValue() as number | undefined)}</span>
        ),
        sortingFn: "basic",
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "sourceDocumentLabel") {
      return columnHelper.accessor("sourceDocumentLabel", {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const row = ctx.row.original;
          const label = row.sourceDocumentLabel;
          if (row.sourceDocumentHref) {
            return (
              <Link to={row.sourceDocumentHref} className="list-table__link" onClick={(e) => e.stopPropagation()}>
                {label}
              </Link>
            );
          }
          return <span>{label}</span>;
        },
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "relatedOrder") {
      return columnHelper.accessor("relatedOrderLabel", {
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const row = ctx.row.original;
          const label = row.relatedOrderLabel;
          if (row.relatedOrderHref) {
            return (
              <Link to={row.relatedOrderHref} className="list-table__link" onClick={(e) => e.stopPropagation()}>
                {label}
              </Link>
            );
          }
          return <span>{label}</span>;
        },
        enableSorting: column.sortable,
        enableHiding: !column.lockedVisible,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return columnHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? column.id) as keyof StockMovementListRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatMovementsTableValue({
            column,
            value: ctx.getValue(),
            t,
            formatDateTimeUi,
            formatQtyDeltaUi,
            movementTypeLabel,
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
  }) as ColumnDef<StockMovementListRow>[];
}
