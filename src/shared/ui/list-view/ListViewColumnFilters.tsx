import type {
  ListViewColumnFilterClause,
  ListViewColumnFilterModel,
  ListViewFilterKind,
  ListViewFilterOperator,
} from "@/shared/navigation/listViewColumnFilters";

type FilterPrimitive = string | number | boolean | null | undefined;

export type ListViewColumnFilterOption = {
  value: string;
  label: string;
};

export type ListViewColumnFilterConfig<T> = {
  kind: ListViewFilterKind;
  getValue?: (row: T) => FilterPrimitive | FilterPrimitive[];
  operators?: ListViewFilterOperator[];
  options?: ListViewColumnFilterOption[];
};

const FILTERABLE_KINDS = new Set<ListViewFilterKind>(["text", "enum", "number", "date", "datetime", "boolean"]);

export function defaultOperatorsForKind(kind: ListViewFilterKind): ListViewFilterOperator[] {
  switch (kind) {
    case "text":
      return [
        "contains",
        "not_contains",
        "equals",
        "not_equals",
        "starts_with",
        "ends_with",
        "in",
        "not_in",
        "is_empty",
        "is_not_empty",
      ];
    case "enum":
      return ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"];
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "not_between", "is_empty", "is_not_empty"];
    case "date":
      return [
        "equals",
        "not_equals",
        "before",
        "after",
        "on_or_before",
        "on_or_after",
        "between",
        "not_between",
        "is_empty",
        "is_not_empty",
      ];
    case "datetime":
      return ["equals", "not_equals", "before", "after", "between", "not_between", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false", "is_empty", "is_not_empty"];
  }
}

function isNoValueOperator(operator: ListViewFilterOperator): boolean {
  return (
    operator === "is_empty" ||
    operator === "is_not_empty" ||
    operator === "is_true" ||
    operator === "is_false"
  );
}

function isMultiValueOperator(operator: ListViewFilterOperator): boolean {
  return operator === "in" || operator === "not_in";
}

function isRangeOperator(operator: ListViewFilterOperator): boolean {
  return operator === "between" || operator === "not_between";
}

function normalizeText(value: FilterPrimitive): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function normalizeCandidates(value: FilterPrimitive | FilterPrimitive[]): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(normalizeText);
}

function parseNumberValue(value: FilterPrimitive): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: FilterPrimitive): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateTimeValue(value: FilterPrimitive): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function isEmptyCandidate(candidate: string): boolean {
  return candidate.trim() === "";
}

function evaluateText(values: string[], clause: ListViewColumnFilterClause): boolean {
  const normalizedValues = values.map((value) => value.toLowerCase());
  const rawValue = (clause.value ?? "").trim().toLowerCase();
  const rawValues = (clause.values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);

  switch (clause.operator) {
    case "contains":
      return normalizedValues.some((value) => value.includes(rawValue));
    case "not_contains":
      return normalizedValues.every((value) => !value.includes(rawValue));
    case "equals":
      return normalizedValues.some((value) => value === rawValue);
    case "not_equals":
      return normalizedValues.every((value) => value !== rawValue);
    case "starts_with":
      return normalizedValues.some((value) => value.startsWith(rawValue));
    case "ends_with":
      return normalizedValues.some((value) => value.endsWith(rawValue));
    case "in":
      return normalizedValues.some((value) => rawValues.includes(value));
    case "not_in":
      return normalizedValues.every((value) => !rawValues.includes(value));
    case "is_empty":
      return normalizedValues.every(isEmptyCandidate);
    case "is_not_empty":
      return normalizedValues.some((value) => !isEmptyCandidate(value));
    default:
      return true;
  }
}

function evaluateEnum(values: string[], clause: ListViewColumnFilterClause): boolean {
  return evaluateText(values, clause);
}

function evaluateNumber(value: FilterPrimitive, clause: ListViewColumnFilterClause): boolean {
  const candidate = parseNumberValue(value);
  const left = parseNumberValue(clause.value ?? "");
  const right = parseNumberValue(clause.valueTo ?? "");

  switch (clause.operator) {
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    case "eq":
      return candidate != null && left != null && candidate === left;
    case "neq":
      return candidate != null && left != null && candidate !== left;
    case "gt":
      return candidate != null && left != null && candidate > left;
    case "gte":
      return candidate != null && left != null && candidate >= left;
    case "lt":
      return candidate != null && left != null && candidate < left;
    case "lte":
      return candidate != null && left != null && candidate <= left;
    case "between":
      return candidate != null && left != null && right != null && candidate >= left && candidate <= right;
    case "not_between":
      return candidate != null && left != null && right != null && (candidate < left || candidate > right);
    default:
      return true;
  }
}

function evaluateDateLike(
  kind: "date" | "datetime",
  value: FilterPrimitive,
  clause: ListViewColumnFilterClause,
): boolean {
  const parser = kind === "date" ? parseDateValue : parseDateTimeValue;
  const candidate = parser(value);
  const left = parser(clause.value ?? "");
  const right = parser(clause.valueTo ?? "");

  switch (clause.operator) {
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    case "equals":
      return candidate != null && left != null && candidate === left;
    case "not_equals":
      return candidate != null && left != null && candidate !== left;
    case "before":
      return candidate != null && left != null && candidate < left;
    case "after":
      return candidate != null && left != null && candidate > left;
    case "on_or_before":
      return candidate != null && left != null && candidate <= left;
    case "on_or_after":
      return candidate != null && left != null && candidate >= left;
    case "between":
      return candidate != null && left != null && right != null && candidate >= left && candidate <= right;
    case "not_between":
      return candidate != null && left != null && right != null && (candidate < left || candidate > right);
    default:
      return true;
  }
}

function evaluateBoolean(value: FilterPrimitive, clause: ListViewColumnFilterClause): boolean {
  const candidate =
    typeof value === "boolean" ? value : normalizeText(value) === "" ? null : normalizeText(value).toLowerCase() === "true";
  switch (clause.operator) {
    case "is_true":
      return candidate === true;
    case "is_false":
      return candidate === false;
    case "is_empty":
      return candidate == null;
    case "is_not_empty":
      return candidate != null;
    default:
      return true;
  }
}

function isValidClause<T>(
  clause: ListViewColumnFilterClause | null | undefined,
  config?: ListViewColumnFilterConfig<T>,
): clause is ListViewColumnFilterClause {
  if (!clause || !config || !FILTERABLE_KINDS.has(config.kind)) return false;
  const operators = config.operators ?? defaultOperatorsForKind(config.kind);
  if (!operators.includes(clause.operator)) return false;
  if (isNoValueOperator(clause.operator)) return true;
  if (isRangeOperator(clause.operator)) {
    return !!(clause.value?.trim() && clause.valueTo?.trim());
  }
  if (isMultiValueOperator(clause.operator)) {
    return Array.isArray(clause.values) && clause.values.some((value) => value.trim() !== "");
  }
  return !!clause.value?.trim();
}

function evaluateClause<T>(
  row: T,
  colId: string,
  clause: ListViewColumnFilterClause,
  config: ListViewColumnFilterConfig<T>,
): boolean {
  const value: FilterPrimitive | FilterPrimitive[] = config.getValue
    ? config.getValue(row)
    : ((row as Record<string, unknown>)[colId] as FilterPrimitive | FilterPrimitive[]);
  switch (config.kind) {
    case "text":
      return evaluateText(normalizeCandidates(value), clause);
    case "enum":
      return evaluateEnum(normalizeCandidates(value), clause);
    case "number":
      return evaluateNumber(Array.isArray(value) ? value[0] : value, clause);
    case "date":
      return evaluateDateLike("date", Array.isArray(value) ? value[0] : value, clause);
    case "datetime":
      return evaluateDateLike("datetime", Array.isArray(value) ? value[0] : value, clause);
    case "boolean":
      return evaluateBoolean(Array.isArray(value) ? value[0] : value, clause);
    default:
      return true;
  }
}

export function applyListViewColumnFilters<T>(
  rows: T[],
  model: ListViewColumnFilterModel,
  configs: Record<string, ListViewColumnFilterConfig<T>>,
): T[] {
  const activeEntries = Object.entries(model).filter(([colId, clause]) => isValidClause(clause, configs[colId]));
  if (activeEntries.length === 0) return rows;
  return rows.filter((row) =>
    activeEntries.every(([colId, clause]) => evaluateClause(row, colId, clause, configs[colId])),
  );
}

export function applyListViewColumnFiltersCombined<T>(
  rows: T[],
  models: ListViewColumnFilterModel[],
  configs: Record<string, ListViewColumnFilterConfig<T>>,
): T[] {
  const activeEntries: Array<{ colId: string; clause: ListViewColumnFilterClause }> = [];
  for (const model of models) {
    for (const [colId, clause] of Object.entries(model)) {
      if (!isValidClause(clause, configs[colId])) continue;
      activeEntries.push({ colId, clause });
    }
  }
  if (activeEntries.length === 0) return rows;
  return rows.filter((row) =>
    activeEntries.every(({ colId, clause }) => evaluateClause(row, colId, clause, configs[colId])),
  );
}
