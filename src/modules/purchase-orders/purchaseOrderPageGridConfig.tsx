import type { ColDef } from "ag-grid-community";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { itemRepository } from "@/modules/items/repository";
import { lineAmountMoney, roundMoney } from "@/shared/commercialMoney";
import type { TFunction } from "@/shared/i18n/resolve";
import { translateZeroPriceReason } from "@/shared/i18n/reasonLabels";
import type { PurchaseOrderFulfillment, PoLineFulfillment } from "@/shared/planningFulfillment";
import type { ZeroPriceLineReasonCode } from "@/shared/reasonCodes";
import { cn } from "@/lib/utils";
import type { LineFormRow, LineWithItem } from "./purchaseOrderPageModel";

export function ExecutionMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          danger ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function poLinesDisplayColumnDefs(
  t: TFunction,
  fulfillmentByItemId: Map<string, PoLineFulfillment>,
  formatMoney: (value: number | null | undefined, fractionDigits?: number, empty?: string) => string,
): ColDef<LineFormRow>[] {
  const dash = t("domain.audit.summary.emDash");
  const centerCell = "po-grid-cell--center";
  const centerHeader = "po-grid-header--center";
  const numericCell = "po-grid-cell--center tabular-nums";
  return [
    {
      headerName: t("doc.columns.lineNo"),
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
      headerClass: centerHeader,
      cellClass: centerCell,
    },
    {
      headerName: t("doc.columns.itemCode"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      editable: false,
      headerClass: centerHeader,
      cellClass: "po-grid-cell--center font-mono",
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    {
      field: "itemId",
      headerName: t("doc.columns.itemName"),
      flex: 1,
      minWidth: 180,
      editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const item = itemRepository.getById(p.value);
        return item?.name ?? p.value;
      },
    },
    {
      headerName: t("doc.columns.brand"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      editable: false,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      headerName: t("doc.columns.category"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      editable: false,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    {
      field: "qty",
      headerName: t("doc.columns.qty"),
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      editable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
    },
    {
      headerName: t("doc.columns.received"),
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      editable: false,
      sortable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        return String(f.receivedQty);
      },
    },
    {
      headerName: t("doc.columns.remaining"),
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      editable: false,
      sortable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return dash;
        const f = fulfillmentByItemId.get(itemId);
        if (!f) return dash;
        if (f.remainingQty < 0) return t("doc.fulfillment.remainingOver", { qty: f.remainingQty });
        return String(f.remainingQty);
      },
    },
    {
      field: "unitPrice",
      headerName: t("doc.columns.unitPrice"),
      width: 110,
      minWidth: 100,
      maxWidth: 120,
      editable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? formatMoney(p.value, 2, "0")
          : formatMoney(0, 2, "0"),
    },
    {
      headerName: t("doc.columns.lineAmount"),
      width: 120,
      minWidth: 110,
      maxWidth: 130,
      editable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return formatMoney(0, 2, "0");
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? formatMoney(0, 2, "0") : formatMoney(amount, 2, "0");
      },
    },
    {
      headerName: t("doc.columns.zeroPriceReason"),
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      editable: false,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
    },
  ];
}

export function poLinesReadOnlyColumnDefs(
  t: TFunction,
  fulfillment: PurchaseOrderFulfillment | null,
  formatMoney: (value: number | null | undefined, fractionDigits?: number, empty?: string) => string,
): ColDef<LineWithItem>[] {
  const dash = t("domain.audit.summary.emDash");
  const centerCell = "po-grid-cell--center";
  const centerHeader = "po-grid-header--center";
  const numericCell = "po-grid-cell--center tabular-nums";
  return [
    {
      headerName: t("doc.columns.lineNo"),
      valueGetter: (params) =>
        params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
      width: 52,
      minWidth: 48,
      maxWidth: 56,
      sortable: false,
      resizable: true,
      headerClass: centerHeader,
      cellClass: centerCell,
    },
    {
      headerName: t("doc.columns.itemCode"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      headerClass: centerHeader,
      cellClass: "po-grid-cell--center font-mono",
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        return item?.code ?? itemId;
      },
    },
    { field: "itemName", headerName: t("doc.columns.itemName"), flex: 1, minWidth: 180 },
    {
      headerName: t("doc.columns.brand"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.brandId) return "";
        const brand = brandRepository.getById(item.brandId);
        return brand?.code ?? "";
      },
    },
    {
      headerName: t("doc.columns.category"),
      width: 130,
      minWidth: 120,
      maxWidth: 140,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const itemId = p.data?.itemId;
        if (!itemId) return "";
        const item = itemRepository.getById(itemId);
        if (!item?.categoryId) return "";
        const category = categoryRepository.getById(item.categoryId);
        return category?.code ?? "";
      },
    },
    {
      field: "qty",
      headerName: t("doc.columns.qty"),
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      headerClass: centerHeader,
      cellClass: numericCell,
    },
    {
      headerName: t("doc.columns.received"),
      width: 86,
      minWidth: 78,
      maxWidth: 96,
      sortable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return dash;
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return dash;
        return String(row.receivedQty);
      },
    },
    {
      headerName: t("doc.columns.remaining"),
      width: 100,
      minWidth: 88,
      maxWidth: 112,
      sortable: false,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const lineId = p.data?.id;
        if (!lineId || !fulfillment) return dash;
        const row = fulfillment.lines.find((l) => l.lineId === lineId);
        if (!row) return dash;
        if (row.remainingQty < 0) return t("doc.fulfillment.remainingOver", { qty: row.remainingQty });
        return String(row.remainingQty);
      },
    },
    {
      field: "unitPrice",
      headerName: t("doc.columns.unitPrice"),
      width: 110,
      minWidth: 100,
      maxWidth: 120,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueFormatter: (p) =>
        typeof p.value === "number" && !Number.isNaN(p.value)
          ? formatMoney(p.value, 2, "0")
          : formatMoney(0, 2, "0"),
    },
    {
      headerName: t("doc.columns.lineAmount"),
      width: 120,
      minWidth: 110,
      maxWidth: 130,
      headerClass: centerHeader,
      cellClass: numericCell,
      valueGetter: (p) => {
        const qty = p.data?.qty;
        const unitPrice = p.data?.unitPrice;
        if (typeof qty !== "number" || typeof unitPrice !== "number") return formatMoney(0, 2, "0");
        const amount = lineAmountMoney(qty, unitPrice);
        return Number.isNaN(amount) ? formatMoney(0, 2, "0") : formatMoney(amount, 2, "0");
      },
    },
    {
      headerName: t("doc.columns.zeroPriceReason"),
      width: 150,
      minWidth: 130,
      maxWidth: 180,
      headerClass: centerHeader,
      cellClass: centerCell,
      valueGetter: (p) => {
        const up = p.data?.unitPrice;
        if (typeof up !== "number" || roundMoney(up) !== 0) return "";
        const c = p.data?.zeroPriceReasonCode;
        if (typeof c !== "string" || c === "") return "";
        return translateZeroPriceReason(t, c as ZeroPriceLineReasonCode);
      },
    },
  ];
}
