import type { ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type {
  ListViewDeepFilterRule,
  ListViewDeepSortRule,
  ListViewDefinition,
} from "@/shared/ui/list-view/listViewConfig";
import type { ListViewPersonalView } from "@/shared/ui/list-view/listViewColumnSettings";

export type MarkdownJournalTableColumnVisibilityState = Record<string, boolean>;

export type MarkdownJournalTableSortingRule = {
  id: string;
  direction: "asc" | "desc";
  priority: number;
};

export type MarkdownJournalTableColumnFilterRule = {
  id: string;
  operator: ListViewFilterOperator;
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

export function buildMarkdownJournalTableSortingState(sortModel: ListViewUrlSort[]): MarkdownJournalTableSortingRule[] {
  return sortModel.map((entry, index) => ({
    id: entry.colId,
    direction: entry.sort,
    priority: index,
  }));
}

export function buildMarkdownJournalTableColumnFilters(
  columnFilterModel: ListViewColumnFilterModel,
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
  personalViews: ListViewPersonalView[],
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
  columnFilterModel: ListViewColumnFilterModel;
  sortModel: ListViewUrlSort[];
  personalViews: ListViewPersonalView[];
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
