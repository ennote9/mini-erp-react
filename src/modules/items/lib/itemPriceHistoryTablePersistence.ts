import type { ColumnSizingState, SortingState } from "@tanstack/react-table";
import type { ItemPriceHistoryColumnSchema } from "../itemPriceHistoryTableSchema";
import type { ListViewDeepFilterRule } from "@/shared/ui/list-view/listViewConfig";

const SORTING_KEY = "mini-erp:item-prices-history:sorting:v1";
const FILTERS_KEY = "mini-erp:item-prices-history:filters:v1";
const COLUMN_SIZING_KEY = "mini-erp:item-prices-history:columnSizing:v1";

const MAX_REASONABLE_COLUMN_SIZE = 1200;

export function readPersistedSorting(): SortingState {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SORTING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SortingState = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = (row as { id?: unknown }).id;
      const desc = (row as { desc?: unknown }).desc;
      if (typeof id !== "string" || id === "") continue;
      out.push({ id, desc: Boolean(desc) });
    }
    return out;
  } catch {
    return [];
  }
}

export function writePersistedSorting(value: SortingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SORTING_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function sanitizeSortingForSchema(sorting: SortingState, schema: ItemPriceHistoryColumnSchema[]): SortingState {
  const ids = new Set(schema.map((c) => c.id));
  return sorting.filter((s) => ids.has(s.id));
}

export function readPersistedFilters(): ListViewDeepFilterRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ListViewDeepFilterRule[];
  } catch {
    return [];
  }
}

export function writePersistedFilters(value: ListViewDeepFilterRule[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function readPersistedColumnSizing(): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLUMN_SIZING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ColumnSizingState;
  } catch {
    return {};
  }
}

export function writePersistedColumnSizing(value: ColumnSizingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function sanitizeColumnSizing(
  value: ColumnSizingState,
  schema: ItemPriceHistoryColumnSchema[],
): ColumnSizingState {
  const schemaById = new Map(schema.map((column) => [column.id, column]));
  const sanitized: ColumnSizingState = {};

  for (const [columnId, rawSize] of Object.entries(value)) {
    const column = schemaById.get(columnId);
    if (!column) continue;
    if (typeof rawSize !== "number" || !Number.isFinite(rawSize)) continue;

    const min = column.minSize ?? 48;
    const max = Math.min(column.maxSize ?? MAX_REASONABLE_COLUMN_SIZE, MAX_REASONABLE_COLUMN_SIZE);
    const nextSize = Math.max(min, Math.min(max, Math.round(rawSize)));
    sanitized[columnId] = nextSize;
  }

  return sanitized;
}
