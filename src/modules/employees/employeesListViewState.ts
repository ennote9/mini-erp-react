import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type EmployeesTableColumnVisibilityState = Record<string, boolean>;

export type EmployeesTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type EmployeesTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type EmployeesTableWorkingDefinition = {
  columnVisibility: EmployeesTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type EmployeesTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type EmployeesTableListViewState = {
  columnVisibility: EmployeesTableColumnVisibilityState;
  columnOrder: string[];
  sorting: EmployeesTableSortingRule[];
  columnFilters: EmployeesTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: EmployeesTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: EmployeesTableWorkingDefinition | null;
};

export function buildEmployeesTableWorkingDefinition(
  definition: ListViewDefinition | null,
): EmployeesTableWorkingDefinition | null {
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

export function buildEmployeesTableSortingState(sortModel: ListViewUrlSort[]): EmployeesTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildEmployeesTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
): EmployeesTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildEmployeesTablePersonalViews(
  personalViews: ListViewPersonalView[],
): { personalViews: EmployeesTablePersonalView[]; defaultViewId: string | null } {
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

export function buildEmployeesTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
  activeViewId: string | null;
}): EmployeesTableListViewState {
  const workingDefinition = buildEmployeesTableWorkingDefinition(input.definition);
  const personalViews = buildEmployeesTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildEmployeesTableSortingState(input.sortModel),
    columnFilters: buildEmployeesTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
