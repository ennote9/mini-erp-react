import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type PurchaseOrdersTableColumnVisibilityState = Record<string, boolean>;

export type PurchaseOrdersTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type PurchaseOrdersTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
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

export function buildPurchaseOrdersTableSortingState(sortModel: ListViewUrlSort[]): PurchaseOrdersTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildPurchaseOrdersTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
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
  personalViews: ListViewPersonalView[],
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
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
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
