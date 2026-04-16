import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type CustomersTableColumnVisibilityState = Record<string, boolean>;

export type CustomersTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type CustomersTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type CustomersTableWorkingDefinition = {
  columnVisibility: CustomersTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type CustomersTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type CustomersTableListViewState = {
  columnVisibility: CustomersTableColumnVisibilityState;
  columnOrder: string[];
  sorting: CustomersTableSortingRule[];
  columnFilters: CustomersTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: CustomersTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: CustomersTableWorkingDefinition | null;
};

export function buildCustomersTableWorkingDefinition(
  definition: ListViewDefinition | null,
): CustomersTableWorkingDefinition | null {
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

export function buildCustomersTableSortingState(sortModel: ListViewUrlSort[]): CustomersTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildCustomersTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
): CustomersTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildCustomersTablePersonalViews(
  personalViews: ListViewPersonalView[],
): { personalViews: CustomersTablePersonalView[]; defaultViewId: string | null } {
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

export function buildCustomersTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
  activeViewId: string | null;
}): CustomersTableListViewState {
  const workingDefinition = buildCustomersTableWorkingDefinition(input.definition);
  const personalViews = buildCustomersTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildCustomersTableSortingState(input.sortModel),
    columnFilters: buildCustomersTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
