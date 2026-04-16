import type { AgGridFilterOperator } from "@/shared/navigation/agGridColumnFilters";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/ag-grid/listViewConfig";
import type { AgGridPersonalView } from "@/shared/ui/ag-grid/columnSettings";

export type MarkdownJournalTableColumnVisibilityState = Record<string, boolean>;

export type MarkdownJournalTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type MarkdownJournalTableColumnFilterRule = {
  id: string;
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type MarkdownJournalTableWorkingDefinition = {
  columnVisibility: MarkdownJournalTableColumnVisibilityState;
  columnOrder: string[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
};

export type MarkdownJournalTablePersonalView = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

export type MarkdownJournalTableListViewState = {
  columnVisibility: MarkdownJournalTableColumnVisibilityState;
  columnOrder: string[];
  sorting: MarkdownJournalTableSortingRule[];
  columnFilters: MarkdownJournalTableColumnFilterRule[];
  deepFilters: ListViewDeepFilterRule[];
  deepSorts: ListViewDeepSortRule[];
  personalViews: MarkdownJournalTablePersonalView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: MarkdownJournalTableWorkingDefinition | null;
};

export function buildMarkdownJournalTableWorkingDefinition(
  definition: ListViewDefinition | null,
): MarkdownJournalTableWorkingDefinition | null {
  if (!definition) return null;
  const orderedColumns = definition.columns.slice().sort((a, b) => a.order - b.order);
  return {
    columnVisibility: Object.fromEntries(orderedColumns.map((column) => [column.fieldKey, column.visible])),
    columnOrder: orderedColumns.map((column) => column.fieldKey),
    deepFilters: definition.deepFilters,
    deepSorts: definition.deepSorts,
  };
}

export function buildMarkdownJournalTableSortingState(sortModel: UrlGridSort[]): MarkdownJournalTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildMarkdownJournalTableColumnFilters(
  columnFilterModel: AgGridColumnFilterModel,
): MarkdownJournalTableColumnFilterRule[] {
  return Object.entries(columnFilterModel).map(([id, clause]) => ({
    id,
    operator: clause.operator,
    value: clause.value,
    valueTo: clause.valueTo,
    values: clause.values,
  }));
}

export function buildMarkdownJournalTablePersonalViews(
  personalViews: AgGridPersonalView[],
): { personalViews: MarkdownJournalTablePersonalView[]; defaultViewId: string | null } {
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

export function buildMarkdownJournalTableListViewState(input: {
  definition: ListViewDefinition | null;
  columnFilterModel: AgGridColumnFilterModel;
  sortModel: UrlGridSort[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
}): MarkdownJournalTableListViewState {
  const workingDefinition = buildMarkdownJournalTableWorkingDefinition(input.definition);
  const personalViews = buildMarkdownJournalTablePersonalViews(input.personalViews);
  return {
    columnVisibility: workingDefinition?.columnVisibility ?? {},
    columnOrder: workingDefinition?.columnOrder ?? [],
    sorting: buildMarkdownJournalTableSortingState(input.sortModel),
    columnFilters: buildMarkdownJournalTableColumnFilters(input.columnFilterModel),
    deepFilters: workingDefinition?.deepFilters ?? [],
    deepSorts: workingDefinition?.deepSorts ?? [],
    personalViews: personalViews.personalViews,
    activeViewId: input.activeViewId,
    defaultViewId: personalViews.defaultViewId,
    workingDefinition,
  };
}
