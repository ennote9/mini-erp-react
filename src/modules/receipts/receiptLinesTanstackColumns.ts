import type { ColumnDef } from "@tanstack/react-table";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { itemRepository } from "@/modules/items/repository";
import type { TFunction } from "@/shared/i18n/resolve";
import type { ReceiptLine } from "./model";

export type ReceiptLineWithItem = ReceiptLine & { itemName: string; uom: string };

/** Synthetic TanStack column id — sizing keys / select cell detection. */
export const RECEIPT_LINES_TANSTACK_SELECT_COLUMN_ID = "__rowSelect__";

function lineNoColumn(t: TFunction): ColumnDef<ReceiptLineWithItem, unknown> {
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
      const data = table.options.data as ReceiptLineWithItem[];
      const docIdx = data.indexOf(row.original);
      return String((docIdx >= 0 ? docIdx : row.index) + 1);
    },
  };
}

export function buildReceiptLinesTanstackColumns(t: TFunction): ColumnDef<ReceiptLineWithItem, unknown>[] {
  return [
    lineNoColumn(t),
    {
      id: "itemCode",
      accessorFn: (row) => {
        const itemId = row.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.itemCode"),
      cell: ({ getValue }) => String(getValue() ?? ""),
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      size: 220,
      minSize: 180,
      maxSize: 520,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "left" as const },
      header: t("doc.columns.itemName"),
    },
    {
      id: "brand",
      accessorFn: (row) => {
        const itemId = row.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.brand"),
      cell: ({ getValue }) => String(getValue() ?? ""),
    },
    {
      id: "category",
      accessorFn: (row) => {
        const itemId = row.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.category"),
      cell: ({ getValue }) => String(getValue() ?? ""),
    },
    {
      id: "qty",
      accessorKey: "qty",
      size: 100,
      minSize: 88,
      maxSize: 120,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.qty"),
      sortingFn: "basic",
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" && !Number.isNaN(v) ? String(v) : "";
      },
    },
    {
      id: "uom",
      accessorKey: "uom",
      size: 80,
      minSize: 72,
      maxSize: 96,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.uom"),
    },
  ];
}
