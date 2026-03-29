import type { SetURLSearchParams } from "react-router-dom";

export type AgGridFilterKind = "text" | "enum" | "number" | "date" | "datetime" | "boolean";

export type AgGridFilterOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "not_between"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after"
  | "is_true"
  | "is_false";

export type AgGridColumnFilterClause = {
  operator: AgGridFilterOperator;
  value?: string;
  valueTo?: string;
  values?: string[];
};

export type AgGridColumnFilterModel = Record<string, AgGridColumnFilterClause>;

export function serializeAgGridColumnFilterClause(
  colId: string,
  clause: AgGridColumnFilterClause,
): string {
  const parts = [encodeURIComponent(colId), encodeURIComponent(clause.operator)];
  if (Array.isArray(clause.values) && clause.values.length > 0) {
    parts.push(clause.values.map((value) => encodeURIComponent(value)).join(","));
  } else if (clause.valueTo !== undefined) {
    parts.push(encodeURIComponent(clause.value ?? ""));
    parts.push(encodeURIComponent(clause.valueTo));
  } else if (clause.value !== undefined) {
    parts.push(encodeURIComponent(clause.value));
  }
  return parts.join("~");
}

function parseValueList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => decodeURIComponent(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseAgGridColumnFilterClause(raw: string): { colId: string; clause: AgGridColumnFilterClause } | null {
  const parts = raw.split("~");
  if (parts.length < 2) return null;
  const colId = decodeURIComponent(parts[0] ?? "").trim();
  const operator = decodeURIComponent(parts[1] ?? "").trim() as AgGridFilterOperator;
  if (!colId || !operator) return null;

  const clause: AgGridColumnFilterClause = { operator };
  if (parts.length >= 4) {
    clause.value = decodeURIComponent(parts[2] ?? "");
    clause.valueTo = decodeURIComponent(parts[3] ?? "");
  } else if (parts.length === 3) {
    const third = parts[2] ?? "";
    if (third.includes(",")) {
      clause.values = parseValueList(third);
    } else {
      clause.value = decodeURIComponent(third);
    }
  }
  return { colId, clause };
}

export function readUrlAgGridColumnFilters(
  searchParams: URLSearchParams,
  key = "cf",
): AgGridColumnFilterModel {
  const next: AgGridColumnFilterModel = {};
  for (const raw of searchParams.getAll(key)) {
    const parsed = parseAgGridColumnFilterClause(raw);
    if (!parsed) continue;
    next[parsed.colId] = parsed.clause;
  }
  return next;
}

export function writeUrlAgGridColumnFilters(
  model: AgGridColumnFilterModel,
  key = "cf",
): [string, string][] {
  return Object.entries(model)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([colId, clause]) => [key, serializeAgGridColumnFilterClause(colId, clause)]);
}

export function withUrlAgGridColumnFilters(
  searchParams: URLSearchParams,
  model: AgGridColumnFilterModel,
  key = "cf",
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(key);
  for (const [paramKey, value] of writeUrlAgGridColumnFilters(model, key)) {
    next.append(paramKey, value);
  }
  return next;
}

export function replaceUrlAgGridColumnFilters(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  model: AgGridColumnFilterModel,
  key = "cf",
): void {
  setSearchParams(withUrlAgGridColumnFilters(searchParams, model, key), {
    replace: true,
  });
}

export function hasActiveAgGridColumnFilters(model: AgGridColumnFilterModel): boolean {
  return Object.keys(model).length > 0;
}
