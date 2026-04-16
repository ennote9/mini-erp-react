import type { TFunction } from "@/shared/i18n";
import type { StockBalanceListRow } from "./stockBalanceListRowModel";
import type { ListViewFieldDataType } from "@/shared/ui/list-view/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/list-view/listViewConfig/types";

export type StockBalancesTableFilterKind = "text" | "enum" | "number" | "none";
export type StockBalancesTableFormatKind =
  | "none"
  | "integer-qty"
  | "stock-style"
  | "coverage-label";

export type StockBalancesTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof StockBalanceListRow;
  dataType: ListViewFieldDataType;
  sourceType: ListViewFieldSourceType;
  defaultVisible: boolean;
  lockedVisible: boolean;
  sortable: boolean;
  filterable: boolean;
  exportable: boolean;
  selectable: boolean;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  defaultFlex?: number;
  rendererType: ListViewRendererType;
  performanceCost: ListViewPerformanceCost;
  filterKind: StockBalancesTableFilterKind;
  formatKind?: StockBalancesTableFormatKind;
  cellDataType?: boolean;
};

type BuildStockBalancesTableSchemaInput = {
  t: TFunction;
  showOperationalGrid: boolean;
};

const BASE_COLUMNS = (t: TFunction): Omit<StockBalancesTableColumnSchema, "defaultVisible">[] => [
  {
    id: "lineNo",
    label: t("doc.columns.lineNo"),
    dataType: "identifier",
    sourceType: "system",
    lockedVisible: true,
    sortable: false,
    filterable: false,
    exportable: true,
    selectable: true,
    defaultSize: 56,
    minSize: 56,
    maxSize: 56,
    rendererType: "text",
    performanceCost: "low",
    filterKind: "none",
  },
  {
    id: "itemCode",
    label: t("doc.columns.itemCode"),
    accessorKey: "itemCode",
    dataType: "identifier",
    sourceType: "lookup",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 118,
    minSize: 100,
    maxSize: 200,
    rendererType: "text",
    performanceCost: "low",
    filterKind: "text",
  },
  {
    id: "itemName",
    label: t("doc.columns.itemName"),
    accessorKey: "itemName",
    dataType: "string",
    sourceType: "lookup",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 200,
    minSize: 140,
    maxSize: 560,
    rendererType: "text",
    performanceCost: "low",
    filterKind: "text",
  },
  {
    id: "warehouseName",
    label: t("doc.columns.warehouse"),
    accessorKey: "warehouseName",
    dataType: "reference",
    sourceType: "lookup",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 140,
    minSize: 120,
    maxSize: 280,
    rendererType: "text",
    performanceCost: "low",
    filterKind: "enum",
  },
  {
    id: "style",
    label: t("doc.columns.style"),
    accessorKey: "style",
    dataType: "enum",
    sourceType: "document",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 118,
    minSize: 108,
    maxSize: 160,
    rendererType: "text",
    performanceCost: "low",
    filterKind: "enum",
    formatKind: "stock-style",
  },
  {
    id: "qtyOnHand",
    label: t("doc.columns.totalQuantity"),
    accessorKey: "qtyOnHand",
    dataType: "number",
    sourceType: "document",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 112,
    minSize: 96,
    maxSize: 160,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
];

const OPERATIONAL_COLUMNS = (t: TFunction): Omit<StockBalancesTableColumnSchema, "defaultVisible">[] => [
  {
    id: "reservedQty",
    label: t("doc.columns.reserved"),
    accessorKey: "reservedQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 96,
    minSize: 80,
    maxSize: 140,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "availableQty",
    label: t("doc.columns.available"),
    accessorKey: "availableQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 100,
    minSize: 88,
    maxSize: 140,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "deficitQty",
    label: t("doc.columns.deficit"),
    accessorKey: "deficitQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 88,
    minSize: 72,
    maxSize: 120,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "outgoingQty",
    label: t("doc.columns.outgoing"),
    accessorKey: "outgoingQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 96,
    minSize: 80,
    maxSize: 140,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "incomingQty",
    label: t("doc.columns.incoming"),
    accessorKey: "incomingQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 96,
    minSize: 80,
    maxSize: 140,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "netShortageQty",
    label: t("doc.columns.netShortage"),
    accessorKey: "netShortageQty",
    dataType: "number",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 104,
    minSize: 88,
    maxSize: 160,
    rendererType: "numeric",
    performanceCost: "low",
    filterKind: "number",
    formatKind: "integer-qty",
    cellDataType: true,
  },
  {
    id: "coverageStatus",
    label: t("doc.columns.coverage"),
    accessorKey: "coverageStatus",
    dataType: "enum",
    sourceType: "derived",
    lockedVisible: false,
    sortable: true,
    filterable: true,
    exportable: true,
    selectable: true,
    defaultSize: 102,
    minSize: 92,
    maxSize: 140,
    rendererType: "status-badge",
    performanceCost: "low",
    filterKind: "enum",
    formatKind: "coverage-label",
  },
];

export function buildStockBalancesTableSchema(input: BuildStockBalancesTableSchemaInput): StockBalancesTableColumnSchema[] {
  const { t, showOperationalGrid } = input;
  const base = BASE_COLUMNS(t).map((c) => ({ ...c, defaultVisible: true }));
  if (!showOperationalGrid) return base;
  return [...base, ...OPERATIONAL_COLUMNS(t).map((c) => ({ ...c, defaultVisible: true }))];
}
