import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type PurchaseOrdersTableColumnVisibilityState = Record<string, boolean>;

export type PurchaseOrdersTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type PurchaseOrdersTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type PurchaseOrdersTableWorkingDefinition = {
  columnVisibility: PurchaseOrdersTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type PurchaseOrdersTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type PurchaseOrdersTableListViewState = {
  columnVisibility: PurchaseOrdersTableColumnVisibilityState;
  columnOrder: string[];
  sorting: PurchaseOrdersTableSortingRule[];
  columnFilters: PurchaseOrdersTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: PurchaseOrdersTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: PurchaseOrdersTableWorkingDefinition | null;
};

export function buildPurchaseOrdersTableWorkingDefinition(
  definition: ListViewDefinition | null,
): PurchaseOrdersTableWorkingDefinition | null {
  if (!definition) return null;
  const orderedColumns = definition.columns.slice().sort((a, b) => a.order - b.order);
  return {
    columnVisibility: Object.fromEntries(
      orderedColumns.map((column) => [column.fieldKey, column.visible]),
    ),
    columnOrder: orderedColumns.map((column) => column.fieldKey),
    deepFilters: definition.deepFilters,
    deepSorts: definition.deepSorts,
  };
}

export function buildPurchaseOrdersTableSortingState(sortModel: UrlGridSort[]): PurchaseOrdersTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildPurchaseOrdersTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): PurchaseOrdersTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildPurchaseOrdersTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: PurchaseOrdersTablePersonalView[]; defaultViewId: string | null } {
  const mapped = personalViews.map((view) => ({
    id: view.viewId,
    name: view.name,
    isDefault: view.isDefault,
    isActive: view.isActive,
  }));
  return {
    personalViews: mapped,
    defaultViewId: mapped.find((view) => view.isDefault)?.id ?? null,
  };
}

export function buildPurchaseOrdersTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): PurchaseOrdersTableListViewState {
  const workingDefinition = buildPurchaseOrdersTableWorkingDefinition(input.definition);
  const personalViews = buildPurchaseOrdersTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildPurchaseOrdersTableSortingState(input.sortModel),
    columnFilters: buildPurchaseOrdersTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
