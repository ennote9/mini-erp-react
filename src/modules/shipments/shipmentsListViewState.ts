import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type ShipmentsTableColumnVisibilityState = Record<string, boolean>;

export type ShipmentsTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type ShipmentsTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
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

export function buildShipmentsTableSortingState(sortModel: ListViewUrlSort[]): ShipmentsTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildShipmentsTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
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
  personalViews: ListViewPersonalView[],
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
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
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
