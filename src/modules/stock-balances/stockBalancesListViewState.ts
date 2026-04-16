import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type StockBalancesTableColumnVisibilityState = Record<string, boolean>;

export type StockBalancesTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type StockBalancesTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type StockBalancesTableWorkingDefinition = {
  columnVisibility: StockBalancesTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type StockBalancesTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type StockBalancesTableListViewState = {
  columnVisibility: StockBalancesTableColumnVisibilityState;
  columnOrder: string[];
  sorting: StockBalancesTableSortingRule[];
  columnFilters: StockBalancesTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: StockBalancesTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: StockBalancesTableWorkingDefinition | null;
};

export function buildStockBalancesTableWorkingDefinition(
  definition: ListViewDefinition | null,
): StockBalancesTableWorkingDefinition | null {
  if (!definition) return null;
  const orderedColumns = definition.columns.slice().sort((a, b) => a.order - b.order);
  return {
    columnVisibility: Object.fromEntries(orderedColumns.map((column) => [column.fieldKey, column.visible])),
    columnOrder: orderedColumns.map((column) => column.fieldKey),
    deepFilters: definition.deepFilters,
    deepSorts: definition.deepSorts,
  };
}

export function buildStockBalancesTableSortingState(sortModel: ListViewUrlSort[]): StockBalancesTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildStockBalancesTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
): StockBalancesTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildStockBalancesTablePersonalViews(
  personalViews: ListViewPersonalView[],
): { personalViews: StockBalancesTablePersonalView[]; defaultViewId: string | null } {
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

export function buildStockBalancesTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
  activeViewId: string | null;
}): StockBalancesTableListViewState {
  const workingDefinition = buildStockBalancesTableWorkingDefinition(input.definition);
  const personalViews = buildStockBalancesTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildStockBalancesTableSortingState(input.sortModel),
    columnFilters: buildStockBalancesTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
