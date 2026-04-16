import type { ColumnDef } from "@tanstack/react-table";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { itemRepository } from "@/modules/items/repository";
import { lineAmountMoney, roundMoney } from "@/shared/commercialMoney";
import type { TFunction } from "@/shared/i18n/resolve";
import { translateZeroPriceReason } from "@/shared/i18n/reasonLabels";
import type { PurchaseOrderFulfillment, PoLineFulfillment } from "@/shared/planningFulfillment";
import type { ZeroPriceLineReasonCode } from "@/shared/reasonCodes";
import type { LineFormRow, LineWithItem } from "./purchaseOrderPageModel";

/** Synthetic TanStack column id — sizing keys / select cell detection. */
export const PO_LINES_TANSTACK_SELECT_COLUMN_ID = "__rowSelect__";

type MoneyFmt = (value: number | null | undefined, fractionDigits?: number, empty?: string) => string;

function lineNoColumn<T extends object>(t: TFunction): ColumnDef<T, unknown> {
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
      const data = table.options.data as T[];
      const docIdx = data.indexOf(row.original);
      return String((docIdx >= 0 ? docIdx : row.index) + 1);
    },
  };
}

export function buildPurchaseOrderEditableLinesTanstackColumns(
  t: TFunction,
  fulfillmentByItemId: Map<string, PoLineFulfillment>,
  formatMoney: MoneyFmt,
): ColumnDef<LineFormRow, unknown>[] {
  const dash = t("domain.audit.summary.emDash");
  return [
    lineNoColumn<LineFormRow>(t),
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
      accessorFn: (row) => {
        const item = itemRepository.getById(row.itemId);
        return item?.name ?? row.itemId ?? "";
      },
      size: 220,
      minSize: 180,
      maxSize: 520,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "left" as const },
      header: t("doc.columns.itemName"),
      cell: ({ getValue }) => String(getValue() ?? ""),
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
      size: 80,
      minSize: 70,
      maxSize: 90,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.qty"),
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" && !Number.isNaN(v) ? String(v) : "";
      },
    },
    {
      id: "received",
      accessorFn: (row) => {
        const f = fulfillmentByItemId.get(row.itemId);
        return f ? f.receivedQty : Number.NEGATIVE_INFINITY;
      },
      size: 86,
      minSize: 78,
      maxSize: 96,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.received"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        return String(f.receivedQty);
      },
    },
    {
      id: "remaining",
      accessorFn: (row) => {
        const f = fulfillmentByItemId.get(row.itemId);
        return f ? f.remainingQty : Number.NEGATIVE_INFINITY;
      },
      size: 100,
      minSize: 88,
      maxSize: 112,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.remaining"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        if (f.remainingQty < 0) return t("doc.fulfillment.remainingOver", { qty: f.remainingQty });
        return String(f.remainingQty);
      },
    },
    {
      id: "unitPrice",
      accessorKey: "unitPrice",
      size: 110,
      minSize: 100,
      maxSize: 120,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.unitPrice"),
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" && !Number.isNaN(v) ? formatMoney(v, 2, "0") : formatMoney(0, 2, "0");
      },
    },
    {
      id: "lineAmount",
      accessorFn: (row) => {
        const qty = row.qty;
        const unitPrice = row.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return 0;
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? 0 : amount;
      },
      size: 120,
      minSize: 110,
      maxSize: 130,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.lineAmount"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const qty = row.original.qty;
        const unitPrice = row.original.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return formatMoney(0, 2, "0");
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? formatMoney(0, 2, "0") : formatMoney(amount, 2, "0");
      },
    },
    {
      id: "zeroPriceReason",
      accessorFn: (row) => {
        const up = row.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = row.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
      size: 150,
      minSize: 130,
      maxSize: 180,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.zeroPriceReason"),
      cell: ({ getValue }) => String(getValue() ?? ""),
    },
  ];
}

export function buildPurchaseOrderReadonlyLinesTanstackColumns(
  t: TFunction,
  fulfillment: PurchaseOrderFulfillment | null,
  formatMoney: MoneyFmt,
): ColumnDef<LineWithItem, unknown>[] {
  const dash = t("domain.audit.summary.emDash");
  return [
    lineNoColumn<LineWithItem>(t),
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
      size: 80,
      minSize: 70,
      maxSize: 90,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.qty"),
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" && !Number.isNaN(v) ? String(v) : "";
      },
    },
    {
      id: "received",
      accessorFn: (row) => {
        const lineId = row.id;
        if (!lineId || !fulfillment) return Number.NEGATIVE_INFINITY;
        const fl = fulfillment.lines.find((l) => l.lineId === lineId);
        return fl ? fl.receivedQty : Number.NEGATIVE_INFINITY;
      },
      size: 86,
      minSize: 78,
      maxSize: 96,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.received"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const lineId = row.original.id;
        if (!lineId || !fulfillment) return dash;
        const fl = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!fl) return dash;
        return String(fl.receivedQty);
      },
    },
    {
      id: "remaining",
      accessorFn: (row) => {
        const lineId = row.id;
        if (!lineId || !fulfillment) return Number.NEGATIVE_INFINITY;
        const fl = fulfillment.lines.find((l) => l.lineId === lineId);
        return fl ? fl.remainingQty : Number.NEGATIVE_INFINITY;
      },
      size: 100,
      minSize: 88,
      maxSize: 112,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.remaining"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const lineId = row.original.id;
        if (!lineId || !fulfillment) return dash;
        const fl = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!fl) return dash;
        if (fl.remainingQty < 0) return t("doc.fulfillment.remainingOver", { qty: fl.remainingQty });
        return String(fl.remainingQty);
      },
    },
    {
      id: "unitPrice",
      accessorKey: "unitPrice",
      size: 110,
      minSize: 100,
      maxSize: 120,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.unitPrice"),
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return typeof v === "number" && !Number.isNaN(v) ? formatMoney(v, 2, "0") : formatMoney(0, 2, "0");
      },
    },
    {
      id: "lineAmount",
      accessorFn: (row) => {
        const qty = row.qty;
        const unitPrice = row.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return 0;
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? 0 : amount;
      },
      size: 120,
      minSize: 110,
      maxSize: 130,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.lineAmount"),
      sortingFn: "basic",
      cell: ({ row }) => {
        const qty = row.original.qty;
        const unitPrice = row.original.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return formatMoney(0, 2, "0");
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? formatMoney(0, 2, "0") : formatMoney(amount, 2, "0");
      },
    },
    {
      id: "zeroPriceReason",
      accessorFn: (row) => {
        const up = row.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = row.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
      size: 150,
      minSize: 130,
      maxSize: 180,
      enableSorting: true,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.zeroPriceReason"),
      cell: ({ getValue }) => String(getValue() ?? ""),
    },
  ];
}
