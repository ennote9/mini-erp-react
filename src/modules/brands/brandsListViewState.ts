import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type BrandsTableColumnVisibilityState = Record<string, boolean>;

export type BrandsTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type BrandsTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type BrandsTableWorkingDefinition = {
  columnVisibility: BrandsTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type BrandsTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type BrandsTableListViewState = {
  columnVisibility: BrandsTableColumnVisibilityState;
  columnOrder: string[];
  sorting: BrandsTableSortingRule[];
  columnFilters: BrandsTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: BrandsTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: BrandsTableWorkingDefinition | null;
};

export function buildBrandsTableWorkingDefinition(
  definition: ListViewDefinition | null,
): BrandsTableWorkingDefinition | null {
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

export function buildBrandsTableSortingState(sortModel: ListViewUrlSort[]): BrandsTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildBrandsTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
): BrandsTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildBrandsTablePersonalViews(
  personalViews: ListViewPersonalView[],
): { personalViews: BrandsTablePersonalView[]; defaultViewId: string | null } {
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

export function buildBrandsTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
  activeViewId: string | null;
}): BrandsTableListViewState {
  const workingDefinition = buildBrandsTableWorkingDefinition(input.definition);
  const personalViews = buildBrandsTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildBrandsTableSortingState(input.sortModel),
    columnFilters: buildBrandsTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
