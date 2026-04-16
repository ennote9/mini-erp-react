import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type SalesOrdersTableColumnVisibilityState = Record<string, boolean>;

export type SalesOrdersTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type SalesOrdersTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type SalesOrdersTableWorkingDefinition = {
  columnVisibility: SalesOrdersTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type SalesOrdersTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type SalesOrdersTableListViewState = {
  columnVisibility: SalesOrdersTableColumnVisibilityState;
  columnOrder: string[];
  sorting: SalesOrdersTableSortingRule[];
  columnFilters: SalesOrdersTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: SalesOrdersTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: SalesOrdersTableWorkingDefinition | null;
};

export function buildSalesOrdersTableWorkingDefinition(
  definition: ListViewDefinition | null,
): SalesOrdersTableWorkingDefinition | null {
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

export function buildSalesOrdersTableSortingState(sortModel: UrlGridSort[]): SalesOrdersTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildSalesOrdersTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): SalesOrdersTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildSalesOrdersTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: SalesOrdersTablePersonalView[]; defaultViewId: string | null } {
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

export function buildSalesOrdersTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): SalesOrdersTableListViewState {
  const workingDefinition = buildSalesOrdersTableWorkingDefinition(input.definition);
  const personalViews = buildSalesOrdersTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildSalesOrdersTableSortingState(input.sortModel),
    columnFilters: buildSalesOrdersTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
