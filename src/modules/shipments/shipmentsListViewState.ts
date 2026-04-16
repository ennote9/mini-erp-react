import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type ShipmentsTableColumnVisibilityState = Record<string, boolean>;

export type ShipmentsTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type ShipmentsTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type ShipmentsTableWorkingDefinition = {
  columnVisibility: ShipmentsTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type ShipmentsTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type ShipmentsTableListViewState = {
  columnVisibility: ShipmentsTableColumnVisibilityState;
  columnOrder: string[];
  sorting: ShipmentsTableSortingRule[];
  columnFilters: ShipmentsTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: ShipmentsTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: ShipmentsTableWorkingDefinition | null;
};

export function buildShipmentsTableWorkingDefinition(
  definition: ListViewDefinition | null,
): ShipmentsTableWorkingDefinition | null {
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

export function buildShipmentsTableSortingState(sortModel: UrlGridSort[]): ShipmentsTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildShipmentsTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): ShipmentsTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildShipmentsTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: ShipmentsTablePersonalView[]; defaultViewId: string | null } {
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

export function buildShipmentsTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): ShipmentsTableListViewState {
  const workingDefinition = buildShipmentsTableWorkingDefinition(input.definition);
  const personalViews = buildShipmentsTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildShipmentsTableSortingState(input.sortModel),
    columnFilters: buildShipmentsTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
