import type { ListViewColumnFilterClause, ListViewColumnFilterModel, ListViewFilterOperator } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewDeepFilterRule, ListViewFieldDataType, ListViewFieldRegistryEntry } from "./types";

const EMPTY_OPERATORS = new Set<ListViewFilterOperator>(["is_empty", "is_not_empty", "is_true", "is_false"]);
const RANGE_OPERATORS = new Set<ListViewFilterOperator>(["between", "not_between"]);
const MULTI_OPERATORS = new Set<ListViewFilterOperator>(["in", "not_in"]);

const COMPATIBILITY: Record<ListViewFieldDataType, ListViewFilterOperator[]> = {
  string: ["contains", "not_contains", "equals", "not_equals", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  identifier: ["contains", "not_contains", "equals", "not_equals", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  reference: ["contains", "not_contains", "equals", "not_equals", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "not_between", "is_empty", "is_not_empty"],
  money: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "not_between", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "before", "after", "on_or_before", "on_or_after", "between", "not_between", "is_empty", "is_not_empty"],
  datetime: ["equals", "not_equals", "before", "after", "between", "not_between", "is_empty", "is_not_empty"],
  boolean: ["is_true", "is_false", "is_empty", "is_not_empty"],
  enum: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
};

export function getSupportedOperatorsByFieldType(dataType: ListViewFieldDataType): ListViewFilterOperator[] {
  return COMPATIBILITY[dataType] ?? [];
}

function isRuleValueValid(rule: ListViewDeepFilterRule): boolean {
  if (EMPTY_OPERATORS.has(rule.operator)) return true;
  if (RANGE_OPERATORS.has(rule.operator)) return !!rule.value?.trim() && !!rule.valueTo?.trim();
  if (MULTI_OPERATORS.has(rule.operator)) return Array.isArray(rule.values) && rule.values.some((v) => v.trim() !== "");
  return !!rule.value?.trim();
}

function normalizeValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeValues(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const normalized = values
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeDeepFilterRules(input: {
  rules: ListViewDeepFilterRule[] | null | undefined;
  registry: ListViewFieldRegistryEntry[];
  visibleFieldKeys?: Set<string>;
}): ListViewDeepFilterRule[] {
  const { rules, registry, visibleFieldKeys } = input;
  if (!rules || rules.length === 0) return [];
  const registryByKey = new Map(registry.map((field) => [field.fieldKey, field]));
  const normalized = rules
    .map((rule, index): ListViewDeepFilterRule | null => {
      if (!rule || typeof rule.fieldKey !== "string" || rule.fieldKey.trim() === "") return null;
      const field = registryByKey.get(rule.fieldKey);
      if (!field || !field.filterable) return null;
      if (visibleFieldKeys && !visibleFieldKeys.has(rule.fieldKey)) return null;
      const supported = getSupportedOperatorsByFieldType(field.dataType);
      if (!supported.includes(rule.operator)) return null;

      const nextRule: ListViewDeepFilterRule = {
        fieldKey: rule.fieldKey,
        operator: rule.operator,
        value: normalizeValue(rule.value),
        valueTo: normalizeValue(rule.valueTo),
        values: normalizeValues(rule.values),
        enabled: rule.enabled !== false,
        priority: Number.isFinite(rule.priority) ? Math.trunc(rule.priority) : index,
      };
      return {
        ...nextRule,
        priority: index,
      };
    })
    .filter((rule): rule is ListViewDeepFilterRule => rule !== null);

  return normalized.sort((a, b) => a.priority - b.priority).map((rule, index) => ({ ...rule, priority: index }));
}

export function buildListViewColumnFilterModelFromDeepRules(rules: ListViewDeepFilterRule[]): ListViewColumnFilterModel {
  const model: ListViewColumnFilterModel = {};
  const sorted = [...rules].filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (!isRuleValueValid(rule)) continue;
    const clause: ListViewColumnFilterClause = { operator: rule.operator };
    if (rule.value !== undefined) clause.value = rule.value;
    if (rule.valueTo !== undefined) clause.valueTo = rule.valueTo;
    if (rule.values !== undefined) clause.values = rule.values;
    model[rule.fieldKey] = clause;
  }
  return model;
}

export function pruneDeepFilterRulesByHiddenFields(
  rules: ListViewDeepFilterRule[],
  hiddenFieldIds: string[],
): ListViewDeepFilterRule[] {
  if (hiddenFieldIds.length === 0) return rules;
  const hidden = new Set(hiddenFieldIds);
  return rules.filter((rule) => !hidden.has(rule.fieldKey)).map((rule, index) => ({ ...rule, priority: index }));
}
