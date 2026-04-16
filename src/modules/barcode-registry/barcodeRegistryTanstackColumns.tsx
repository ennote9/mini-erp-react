import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { ScanBarcode, TicketPercent } from "lucide-react";
import type { TFunction } from "@/shared/i18n";
import type { ItemBarcodeSymbology } from "@/modules/items";
import { GridOutlinePillBadge } from "@/shared/ui/ag-grid/GridOutlinePillBadge";
import type { BarcodeRegistryEntryType, BarcodeRegistryRow, BarcodeRegistrySource } from "./barcodeRegistryReadModel";
import type { BarcodeRegistryTableColumnSchema } from "./barcodeRegistryTableSchema";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

export type BuildBarcodeRegistryTanstackColumnsInput = {
  schema: BarcodeRegistryTableColumnSchema[];
  t: TFunction;
  entryTypeLabel: (value: BarcodeRegistryEntryType) => string;
  sourceLabel: (value: BarcodeRegistrySource) => string;
  symbologyLabel: (value?: ItemBarcodeSymbology) => string;
  markdownStatusLabel: (value?: string) => string;
};

const columnHelper = createColumnHelper<BarcodeRegistryRow>();

function emDashLabel(t: TFunction): string {
  return t("domain.audit.summary.emDash");
}

export function formatBarcodeRegistryTableValue(input: {
  column: BarcodeRegistryTableColumnSchema;
  value: unknown;
  t: TFunction;
  rowIndex?: number;
  entryTypeLabel: (value: BarcodeRegistryEntryType) => string;
  sourceLabel: (value: BarcodeRegistrySource) => string;
  symbologyLabel: (value?: ItemBarcodeSymbology) => string;
  markdownStatusLabel: (value?: string) => string;
}): string {
  const {
    column,
    value,
    t,
    rowIndex,
    entryTypeLabel,
    sourceLabel,
    symbologyLabel,
    markdownStatusLabel,
  } = input;
  const em = emDashLabel(t);

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.formatKind === "entry-type") {
    if (value == null || value === "") return em;
    return entryTypeLabel(value as BarcodeRegistryEntryType);
  }
  if (column.formatKind === "source") {
    if (value == null || value === "") return em;
    return sourceLabel(value as BarcodeRegistrySource);
  }
  if (column.formatKind === "symbology") {
    return symbologyLabel(value as ItemBarcodeSymbology | undefined);
  }
  if (column.formatKind === "markdown-status") {
    return markdownStatusLabel(value as string | undefined);
  }
  if (column.formatKind === "optional-text") {
    if (value == null || value === "") return em;
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
  return String(value);
}

function getColumnAlign(column: BarcodeRegistryTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildBarcodeRegistryTanstackColumns(
  input: BuildBarcodeRegistryTanstackColumnsInput,
): ColumnDef<BarcodeRegistryRow>[] {
  const { schema, t, entryTypeLabel, sourceLabel, symbologyLabel, markdownStatusLabel } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = {
      align: getColumnAlign(column),
    };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatBarcodeRegistryTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            rowIndex: ctx.row.index,
            entryTypeLabel,
            sourceLabel,
            symbologyLabel,
            markdownStatusLabel,
          }),
        enableSorting: false,
        enableHiding: false,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    if (column.id === "entryType") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) => {
          const v = ctx.row.original.entryType;
          if (v === "MARKDOWN_CODE") {
            return (
              <GridOutlinePillBadge tone="warning">
                <TicketPercent className="mr-1 h-3 w-3" />
                {entryTypeLabel(v)}
              </GridOutlinePillBadge>
            );
          }
          return (
            <GridOutlinePillBadge tone="muted">
              <ScanBarcode className="mr-1 h-3 w-3" />
              {entryTypeLabel(v ?? "ITEM_BARCODE")}
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

    return columnHelper.accessor(
      (row): unknown => row[(column.accessorKey ?? "code") as keyof BarcodeRegistryRow],
      {
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatBarcodeRegistryTableValue({
            column,
            value: ctx.getValue(),
            t,
            rowIndex: ctx.row.index,
            entryTypeLabel,
            sourceLabel,
            symbologyLabel,
            markdownStatusLabel,
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
