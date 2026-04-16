import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n/resolve";

export type MarkdownCreateLineGridRow = {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  reason: string;
};

export type MarkdownCreateCodeGridRow = {
  id: string;
  markdownCode: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  markdownPrice: number;
  reason: string;
  warehouse: string;
  status: string;
  postedAt: string;
  printCount: number;
  printedAt: string;
};

/** Synthetic TanStack column id — sizing keys / select cell detection (codes grid). */
export const MARKDOWN_CREATE_TANSTACK_SELECT_COLUMN_ID = "__rowSelect__";

type MoneyFmt = (value: number | null | undefined, fractionDigits?: number, empty?: string) => string;

function lineNoColumn<T>(t: TFunction): ColumnDef<T, unknown> {
  return {
    id: "lineNo",
    size: 56,
    minSize: 56,
    maxSize: 56,
    enableSorting: false,
    enableResizing: true,
    meta: { align: "center" as const },
    header: t("doc.columns.lineNo"),
    cell: ({ row, table }) => {
      const data = table.options.data as T[];
      const docIdx = data.indexOf(row.original);
      return String((docIdx >= 0 ? docIdx : row.index) + 1);
    },
  };
}

export function buildMarkdownCreateLineGridColumns(
  t: TFunction,
  formatMoney: MoneyFmt,
): ColumnDef<MarkdownCreateLineGridRow, unknown>[] {
  return [
    lineNoColumn<MarkdownCreateLineGridRow>(t),
    {
      id: "itemCode",
      accessorKey: "itemCode",
      header: t("doc.columns.itemCode"),
      size: 130,
      minSize: 120,
      maxSize: 150,
      sortingFn: "alphanumeric",
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      header: t("doc.columns.itemName"),
      size: 220,
      minSize: 180,
      maxSize: 480,
      sortingFn: "alphanumeric",
    },
    {
      id: "quantity",
      accessorKey: "quantity",
      header: t("doc.columns.qty"),
      size: 90,
      minSize: 80,
      maxSize: 110,
      sortingFn: "basic",
      meta: { align: "right" as const },
    },
    {
      id: "markdownPrice",
      accessorKey: "markdownPrice",
      header: t("markdown.fields.markdownPrice"),
      size: 140,
      minSize: 130,
      maxSize: 160,
      sortingFn: "basic",
      meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" ? formatMoney(v, 2, "") : "";
      },
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: t("markdown.fields.reason"),
      size: 220,
      minSize: 180,
      maxSize: 320,
      sortingFn: "alphanumeric",
    },
  ];
}

export function buildMarkdownCreateCodeGridColumns(
  t: TFunction,
  formatMoney: MoneyFmt,
): ColumnDef<MarkdownCreateCodeGridRow, unknown>[] {
  return [
    lineNoColumn<MarkdownCreateCodeGridRow>(t),
    {
      id: "markdownCode",
      accessorKey: "markdownCode",
      header: t("markdown.fields.markdownCode"),
      size: 150,
      minSize: 140,
      maxSize: 180,
      sortingFn: "alphanumeric",
      meta: { noTruncate: true as const },
    },
    {
      id: "itemCode",
      accessorKey: "itemCode",
      header: t("doc.columns.itemCode"),
      size: 130,
      minSize: 120,
      maxSize: 150,
      sortingFn: "alphanumeric",
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      header: t("doc.columns.itemName"),
      size: 220,
      minSize: 180,
      maxSize: 480,
      sortingFn: "alphanumeric",
    },
    {
      id: "quantity",
      accessorKey: "quantity",
      header: t("doc.columns.qty"),
      size: 90,
      minSize: 80,
      maxSize: 110,
      sortingFn: "basic",
      meta: { align: "right" as const },
    },
    {
      id: "markdownPrice",
      accessorKey: "markdownPrice",
      header: t("markdown.fields.markdownPrice"),
      size: 140,
      minSize: 130,
      maxSize: 160,
      sortingFn: "basic",
      meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" ? formatMoney(v, 2, "") : "";
      },
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: t("markdown.fields.reason"),
      size: 220,
      minSize: 180,
      maxSize: 320,
      sortingFn: "alphanumeric",
    },
    {
      id: "warehouse",
      accessorKey: "warehouse",
      header: t("markdown.fields.targetWarehouse"),
      size: 170,
      minSize: 150,
      maxSize: 280,
      sortingFn: "alphanumeric",
      meta: { noTruncate: true as const },
    },
    {
      id: "status",
      accessorKey: "status",
      header: t("common.status"),
      size: 130,
      minSize: 120,
      maxSize: 160,
      sortingFn: "alphanumeric",
    },
    {
      id: "postedAt",
      accessorKey: "postedAt",
      header: t("markdown.fields.postedAt"),
      size: 200,
      minSize: 180,
      maxSize: 240,
      sortingFn: "alphanumeric",
      meta: { noTruncate: true as const },
    },
    {
      id: "printCount",
      accessorKey: "printCount",
      header: t("markdown.fields.printCount"),
      size: 100,
      minSize: 90,
      maxSize: 120,
      sortingFn: "basic",
      meta: { align: "right" as const },
    },
    {
      id: "printedAt",
      accessorKey: "printedAt",
      header: t("markdown.fields.printedAt"),
      size: 200,
      minSize: 180,
      maxSize: 240,
      sortingFn: "alphanumeric",
      meta: { noTruncate: true as const },
    },
  ];
}
