import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type { ShipmentListRow } from "./shipmentListRowModel";
import type { ShipmentsTableColumnSchema } from "./shipmentsTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

export type BuildShipmentsTanstackColumnsInput = {
  schema: ShipmentsTableColumnSchema[];
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
};

const columnHelper = createColumnHelper<ShipmentListRow>();

export function formatShipmentsTableValue(input: {
  column: ShipmentsTableColumnSchema;
  value: unknown;
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  rowIndex?: number;
}): string {
  const { column, value, t, formatDate, rowIndex } = input;

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "shipment-date") {
    return formatDate(value == null ? undefined : String(value), { empty: "" });
  }

  if (column.formatKind === "factual-status") {
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

function getColumnAlign(column: ShipmentsTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildShipmentsTanstackColumns(
  input: BuildShipmentsTanstackColumnsInput,
): ColumnDef<ShipmentListRow>[] {
  const { schema, t, formatDate } = input;

  return schema.map((column): ColumnDef<ShipmentListRow> => {
    const meta: ColumnMeta = {
      align: getColumnAlign(column),
    };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatShipmentsTableValue({
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

    if (column.id === "trackingLabel") {
      return columnHelper.accessor((row): unknown => row.trackingRaw, {
        id: column.id,
        header: column.label,
        sortingFn: "alphanumeric",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div className="flex min-w-0 w-full items-center gap-2">
              <span className="min-w-0 truncate" title={row.trackingRaw || undefined}>
                {row.trackingLabel}
              </span>
              {row.trackingUrl ? (
                <a
                  href={row.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 whitespace-nowrap text-xs text-primary underline-offset-4 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  onAuxClick={(e) => e.stopPropagation()}
                >
                  {t("ops.list.shipments.openTracking")}
                </a>
              ) : null}
            </div>
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

    return columnHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? "number") as keyof ShipmentListRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatShipmentsTableValue({
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
