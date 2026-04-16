import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";

export type ListViewEntityType =
  | "items"
  | "sales-orders"
  | "purchase-orders"
  | "receipts"
  | "shipments"
  | "stock-balances"
  | "stock-movements"
  | "customers"
  | "suppliers"
  | "warehouses"
  | "carriers"
  | "brands"
  | "categories"
  | "barcodes"
  | "markdown-journal-journals"
  | "markdown-journal-codes";

export type ListViewFieldDataType =
  | "string"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "boolean"
  | "enum"
  | "identifier"
  | "reference";

export type ListViewFieldSourceType = "document" | "derived" | "lookup" | "system";

export type ListViewRendererType = "text" | "status-badge" | "boolean-badge" | "numeric" | "date";

export type ListViewPerformanceCost = "low" | "medium" | "high";

export type ListViewFieldRegistryEntry = {
  fieldKey: string;
  entityType: ListViewEntityType;
  label: string;
  dataType: ListViewFieldDataType;
  sourceType: ListViewFieldSourceType;
  defaultVisible: boolean;
  lockedVisible: boolean;
  sortable: boolean;
  filterable: boolean;
  exportable: boolean;
  selectable: boolean;
  rendererType: ListViewRendererType;
  requiresPermission: string | null;
  performanceCost: ListViewPerformanceCost;
};

export type ListViewColumnState = {
  fieldKey: string;
  visible: boolean;
  order: number;
};

export type ListViewDeepFilterRule = {
  fieldKey: string;
  operator: ListViewFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
  enabled: boolean;
  priority: number;
};

export type ListViewDeepSortRule = {
  fieldKey: string;
  direction: "asc" | "desc";
  enabled: boolean;
  priority: number;
};

export type ListViewDefinition = {
  version: 1;
  entityType: ListViewEntityType;
  columns: ListViewColumnState[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};
