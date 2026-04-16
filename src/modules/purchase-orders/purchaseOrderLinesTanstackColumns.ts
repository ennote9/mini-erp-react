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

function lineNoColumn<T>(t: TFunction): ColumnDef<T, unknown> {
  return {
    id: "lineNo",
    size: 52,
    minSize: 48,
    maxSize: 56,
    enableSorting: false,
    enableResizing: true,
    meta: { align: "center" as const },
    header: t("doc.columns.lineNo"),
    cell: ({ row }) => String(row.index + 1),
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
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.itemCode"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    {
      id: "itemName",
      accessorFn: (row) => row.itemId,
      size: 220,
      minSize: 180,
      maxSize: 520,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "left" as const },
      header: t("doc.columns.itemName"),
      cell: ({ getValue }) => {
        const itemId = getValue() as string;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.name ?? itemId;
      },
    },
    {
      id: "brand",
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.brand"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      id: "category",
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.category"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    {
      id: "qty",
      accessorKey: "qty",
      size: 80,
      minSize: 70,
      maxSize: 90,
      enableSorting: false,
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
      size: 86,
      minSize: 78,
      maxSize: 96,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.received"),
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
      size: 100,
      minSize: 88,
      maxSize: 112,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.remaining"),
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
      enableSorting: false,
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
      size: 120,
      minSize: 110,
      maxSize: 130,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.lineAmount"),
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
      size: 150,
      minSize: 130,
      maxSize: 180,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.zeroPriceReason"),
      cell: ({ row }) => {
        const up = row.original.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = row.original.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
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
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.itemCode"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      size: 220,
      minSize: 180,
      maxSize: 520,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "left" as const },
      header: t("doc.columns.itemName"),
    },
    {
      id: "brand",
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.brand"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      id: "category",
      size: 130,
      minSize: 120,
      maxSize: 140,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.category"),
      cell: ({ row }) => {
        const itemId = row.original.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    {
      id: "qty",
      accessorKey: "qty",
      size: 80,
      minSize: 70,
      maxSize: 90,
      enableSorting: false,
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
      size: 86,
      minSize: 78,
      maxSize: 96,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.received"),
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
      size: 100,
      minSize: 88,
      maxSize: 112,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.remaining"),
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
      enableSorting: false,
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
      size: 120,
      minSize: 110,
      maxSize: 130,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.lineAmount"),
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
      size: 150,
      minSize: 130,
      maxSize: 180,
      enableSorting: false,
      enableResizing: true,
      meta: { align: "center" as const },
      header: t("doc.columns.zeroPriceReason"),
      cell: ({ row }) => {
        const up = row.original.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = row.original.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
    },
  ];
}
