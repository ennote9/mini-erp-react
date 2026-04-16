import type { ColumnDef } from "@tanstack/react-table";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { itemRepository } from "@/modules/items/repository";
import type { TFunction } from "@/shared/i18n/resolve";
import type { ShipmentLine } from "./model";

export type ShipmentLineWithItemRow = ShipmentLine & { itemName: string; uom: string };

/** Synthetic TanStack column id — sizing keys / select cell detection. */
export const SHIPMENT_LINES_TANSTACK_SELECT_COLUMN_ID = "__rowSelect__";

function lineNoColumn(t: TFunction): ColumnDef<ShipmentLineWithItemRow, unknown> {
  return {
    id: "lineNo",
    size: 52,
    minSize: 48,
    maxSize: 56,
    enableSorting: false,
    enableResizing: true,
    meta: { align: "center" as const },
    header: t("doc.columns.lineNo"),
    cell: ({ row, table }) => {
      const data = table.options.data as ShipmentLineWithItemRow[];
      const docIdx = data.indexOf(row.original);
      return String((docIdx >= 0 ? docIdx : row.index) + 1);
    },
  };
}

export function buildShipmentLinesTanstackColumns(t: TFunction): ColumnDef<ShipmentLineWithItemRow, unknown>[] {
  return [
    lineNoColumn(t),
    {
      id: "itemCode",
      accessorFn: (row) => {
        const item = itemRepository.getById(row.itemId);
        return item?.code ?? row.itemId;
      },
      header: t("doc.columns.itemCode"),
      size: 130,
      minSize: 120,
      maxSize: 160,
      sortingFn: "alphanumeric",
      meta: { noTruncate: true as const },
      cell: ({ row }) => {
        const item = itemRepository.getById(row.original.itemId);
        const code = item?.code ?? row.original.itemId;
        const markdownCode = row.original.markdownCode;
        if (markdownCode) {
          return (
            <div className="flex flex-col leading-tight">
              <span>{code}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{markdownCode}</span>
            </div>
          );
        }
        return code;
      },
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      header: t("doc.columns.itemName"),
      size: 220,
      minSize: 180,
      maxSize: 480,
      sortingFn: "alphanumeric",
      meta: { align: "left" as const },
    },
    {
      id: "brand",
      accessorFn: (row) => {
        const item = itemRepository.getById(row.itemId);
        if (!item?.brandId) return "";
        return brandRepository.getById(item.brandId)?.code ?? "";
      },
      header: t("doc.columns.brand"),
      size: 130,
      minSize: 120,
      maxSize: 140,
      sortingFn: "alphanumeric",
    },
    {
      id: "category",
      accessorFn: (row) => {
        const item = itemRepository.getById(row.itemId);
        if (!item?.categoryId) return "";
        return categoryRepository.getById(item.categoryId)?.code ?? "";
      },
      header: t("doc.columns.category"),
      size: 130,
      minSize: 120,
      maxSize: 140,
      sortingFn: "alphanumeric",
    },
    {
      id: "qty",
      accessorKey: "qty",
      header: t("doc.columns.qty"),
      size: 100,
      minSize: 80,
      maxSize: 120,
      sortingFn: "basic",
      meta: { align: "right" as const },
    },
    {
      id: "uom",
      accessorKey: "uom",
      header: t("doc.columns.uom"),
      size: 80,
      minSize: 64,
      maxSize: 96,
      sortingFn: "alphanumeric",
      meta: { align: "left" as const },
    },
  ];
}
