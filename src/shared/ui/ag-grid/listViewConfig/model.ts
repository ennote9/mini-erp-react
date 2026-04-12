import type { ListViewColumnState, ListViewDefinition, ListViewEntityType, ListViewFieldRegistryEntry } from "./types";
import { normalizeDeepFilterRules } from "./deepFilters";
import { normalizeDeepSortRules } from "./deepSorts";

export function buildDefaultListViewDefinition(
  entityType: ListViewEntityType,
  registry: ListViewFieldRegistryEntry[],
): ListViewDefinition {
  return {
    version: 1,
    entityType,
    columns: registry.map((field, index) => ({
      fieldKey: field.fieldKey,
      visible: field.lockedVisible ? true : field.defaultVisible,
      order: index,
    })),
    deepFilters: [],
    deepSorts: [],
  };
}

function isValidColumnState(value: unknown): value is ListViewColumnState {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.fieldKey === "string" &&
    row.fieldKey.trim() !== "" &&
    typeof row.visible === "boolean" &&
    typeof row.order === "number" &&
    Number.isFinite(row.order)
  );
}

export function parsePersistedListViewDefinition(raw: string): ListViewDefinition | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (rec.version !== 1) return null;
    if (typeof rec.entityType !== "string") return null;
    if (!Array.isArray(rec.columns)) return null;
    const columns = rec.columns.filter(isValidColumnState).map((column) => ({
      fieldKey: column.fieldKey,
      visible: column.visible,
      order: Math.trunc(column.order),
    }));
    const deepFilters = Array.isArray(rec.deepFilters) ? (rec.deepFilters as ListViewDefinition["deepFilters"]) : [];
    const deepSorts = Array.isArray(rec.deepSorts) ? (rec.deepSorts as ListViewDefinition["deepSorts"]) : [];
    return {
      version: 1,
      entityType: rec.entityType as ListViewEntityType,
      columns,
      deepFilters,
      deepSorts,
    };
  } catch {
    return null;
  }
}

export function mergeListViewDefinitionWithRegistry(input: {
  entityType: ListViewEntityType;
  registry: ListViewFieldRegistryEntry[];
  persisted: ListViewDefinition | null;
}): ListViewDefinition {
  const { entityType, registry, persisted } = input;
  const fallback = buildDefaultListViewDefinition(entityType, registry);
  if (!persisted || persisted.entityType !== entityType) return fallback;

  const registryByKey = new Map(registry.map((field) => [field.fieldKey, field]));
  const uniquePersisted = new Map<string, ListViewColumnState>();
  for (const column of persisted.columns) {
    if (!registryByKey.has(column.fieldKey)) continue;
    if (uniquePersisted.has(column.fieldKey)) continue;
    uniquePersisted.set(column.fieldKey, column);
  }

  const merged: ListViewColumnState[] = [];
  const orderedPersisted = Array.from(uniquePersisted.values()).sort((a, b) => a.order - b.order);
  for (const column of orderedPersisted) {
    const field = registryByKey.get(column.fieldKey);
    if (!field) continue;
    merged.push({
      fieldKey: field.fieldKey,
      visible: field.lockedVisible ? true : column.visible,
      order: merged.length,
    });
  }

  for (const field of registry) {
    if (merged.some((column) => column.fieldKey === field.fieldKey)) continue;
    merged.push({
      fieldKey: field.fieldKey,
      visible: field.lockedVisible ? true : field.defaultVisible,
      order: merged.length,
    });
  }

  const visibleFieldKeys = new Set(
    merged.filter((column) => column.visible).map((column) => column.fieldKey),
  );
  const deepFilters = normalizeDeepFilterRules({
    rules: persisted.deepFilters,
    registry,
    visibleFieldKeys,
  });
  const deepSorts = normalizeDeepSortRules({
    rules: persisted.deepSorts,
    registry,
    visibleFieldKeys,
  });

  return {
    version: 1,
    entityType,
    columns: merged,
    deepFilters,
    deepSorts,
  };
}
