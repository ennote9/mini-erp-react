import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type { ListViewDeepSortRule, ListViewFieldRegistryEntry } from "./types";

function normalizeDirection(value: unknown): "asc" | "desc" | null {
  return value === "asc" || value === "desc" ? value : null;
}

export function normalizeDeepSortRules(input: {
  rules: ListViewDeepSortRule[] | null | undefined;
  registry: ListViewFieldRegistryEntry[];
  visibleFieldKeys?: Set<string>;
}): ListViewDeepSortRule[] {
  const { rules, registry, visibleFieldKeys } = input;
  if (!rules || rules.length === 0) return [];

  const registryByKey = new Map(registry.map((field) => [field.fieldKey, field]));
  const uniqueFieldKeys = new Set<string>();
  const normalized: ListViewDeepSortRule[] = [];

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (!rule || typeof rule.fieldKey !== "string" || rule.fieldKey.trim() === "") continue;
    const field = registryByKey.get(rule.fieldKey);
    if (!field || !field.sortable) continue;
    if (visibleFieldKeys && !visibleFieldKeys.has(rule.fieldKey)) continue;
    const direction = normalizeDirection(rule.direction);
    if (!direction) continue;
    if (uniqueFieldKeys.has(rule.fieldKey)) continue;
    uniqueFieldKeys.add(rule.fieldKey);
    normalized.push({
      fieldKey: rule.fieldKey,
      direction,
      enabled: rule.enabled !== false,
      priority: Number.isFinite(rule.priority) ? Math.trunc(rule.priority) : index,
    });
  }

  return normalized
    .sort((a, b) => a.priority - b.priority)
    .map((rule, index) => ({ ...rule, priority: index }));
}

export function buildListViewUrlSortFromDeepSortRules(rules: ListViewDeepSortRule[]): ListViewUrlSort[] {
  return [...rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((rule) => ({
      colId: rule.fieldKey,
      sort: rule.direction,
    }));
}

export function pruneDeepSortRulesByHiddenFields(
  rules: ListViewDeepSortRule[],
  hiddenFieldIds: string[],
): ListViewDeepSortRule[] {
  if (hiddenFieldIds.length === 0) return rules;
  const hidden = new Set(hiddenFieldIds);
  return rules
    .filter((rule) => !hidden.has(rule.fieldKey))
    .map((rule, index) => ({ ...rule, priority: index }));
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return Number.isFinite(Number(trimmed));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(String(value).trim());
}

function toTimestamp(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isFinite(ts) ? ts : null;
}

function compareUnknownValues(left: unknown, right: unknown): number {
  const leftMissing = left == null || left === "";
  const rightMissing = right == null || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  const leftTime = toTimestamp(left);
  const rightTime = toTimestamp(right);
  if (leftTime != null && rightTime != null) return leftTime - rightTime;

  if (isNumericLike(left) && isNumericLike(right)) return toNumber(left) - toNumber(right);

  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);

  return String(left).localeCompare(String(right), undefined, { sensitivity: "base", numeric: true });
}

export function applyDeepSortModel<T>(input: {
  rows: T[];
  sortModel: ListViewUrlSort[];
  getFieldValue: (row: T, fieldKey: string) => unknown;
}): T[] {
  const { rows, sortModel, getFieldValue } = input;
  if (sortModel.length === 0 || rows.length < 2) return rows;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const entry of sortModel) {
        const cmp = compareUnknownValues(
          getFieldValue(left.row, entry.colId),
          getFieldValue(right.row, entry.colId),
        );
        if (cmp === 0) continue;
        return entry.sort === "asc" ? cmp : -cmp;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.row);
}
