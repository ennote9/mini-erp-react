import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type BarcodeRegistryTableColumnVisibilityState = Record<string, boolean>;

export type BarcodeRegistryTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type BarcodeRegistryTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type BarcodeRegistryTableWorkingDefinition = {
  columnVisibility: BarcodeRegistryTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type BarcodeRegistryTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type BarcodeRegistryTableListViewState = {
  columnVisibility: BarcodeRegistryTableColumnVisibilityState;
  columnOrder: string[];
  sorting: BarcodeRegistryTableSortingRule[];
  columnFilters: BarcodeRegistryTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: BarcodeRegistryTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: BarcodeRegistryTableWorkingDefinition | null;
};

export function buildBarcodeRegistryTableWorkingDefinition(
  definition: ListViewDefinition | null,
): BarcodeRegistryTableWorkingDefinition | null {
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

export function buildBarcodeRegistryTableSortingState(sortModel: UrlGridSort[]): BarcodeRegistryTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildBarcodeRegistryTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): BarcodeRegistryTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildBarcodeRegistryTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: BarcodeRegistryTablePersonalView[]; defaultViewId: string | null } {
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

export function buildBarcodeRegistryTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): BarcodeRegistryTableListViewState {
  const workingDefinition = buildBarcodeRegistryTableWorkingDefinition(input.definition);
  const personalViews = buildBarcodeRegistryTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildBarcodeRegistryTableSortingState(input.sortModel),
    columnFilters: buildBarcodeRegistryTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
