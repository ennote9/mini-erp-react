import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type CarriersTableColumnVisibilityState = Record<string, boolean>;

export type CarriersTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type CarriersTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type CarriersTableWorkingDefinition = {
  columnVisibility: CarriersTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type CarriersTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type CarriersTableListViewState = {
  columnVisibility: CarriersTableColumnVisibilityState;
  columnOrder: string[];
  sorting: CarriersTableSortingRule[];
  columnFilters: CarriersTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: CarriersTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: CarriersTableWorkingDefinition | null;
};

export function buildCarriersTableWorkingDefinition(
  definition: ListViewDefinition | null,
): CarriersTableWorkingDefinition | null {
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

export function buildCarriersTableSortingState(sortModel: UrlGridSort[]): CarriersTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildCarriersTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): CarriersTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildCarriersTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: CarriersTablePersonalView[]; defaultViewId: string | null } {
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

export function buildCarriersTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): CarriersTableListViewState {
  const workingDefinition = buildCarriersTableWorkingDefinition(input.definition);
  const personalViews = buildCarriersTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildCarriersTableSortingState(input.sortModel),
    columnFilters: buildCarriersTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
