import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import type { AgGridColumnFilterModel } from "@/shared/navigation/agGridColumnFilters";
import type { UrlGridSort } from "@/shared/navigation/agGridSort";
import {
  buildAgGridModelFromDeepFilterRules,
  buildDefaultListViewDefinition,
  buildUrlGridSortFromDeepSortRules,
  getListViewFieldRegistry,
  mergeListViewDefinitionWithRegistry,
  normalizeDeepFilterRules,
  normalizeDeepSortRules,
  parsePersistedListViewDefinition,
  pruneDeepFilterRulesByHiddenFields,
  pruneDeepSortRulesByHiddenFields,
  type ListViewDefinition,
  type ListViewDeepFilterRule,
  type ListViewDeepSortRule,
  type ListViewEntityType,
  type ListViewFieldRegistryEntry,
} from "./listViewConfig";

const STORAGE_PREFIX = "mini-erp:grid-columns:v1:";
const PERSISTED_VERSION = 2;

export type AgGridColumnSettingsItem = {
  id: string;
  label: string;
  visible: boolean;
  lockedVisible: boolean;
  lockedOrder: boolean;
};

export type AgGridPersonalView = {
  viewId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

type LegacyPersistedColumnSettings = {
  listViewDefinition: ListViewDefinition;
};

type PersistedPersonalViewEntry = {
  viewId: string;
  entityType: ListViewEntityType;
  ownerType: "user";
  name: string;
  version: 1;
  listViewDefinition: ListViewDefinition;
};

type PersistedPersonalViewState = {
  version: number;
  entityType: ListViewEntityType;
  personalViews: PersistedPersonalViewEntry[];
  activeViewId: string | null;
  defaultViewId: string | null;
  workingDefinition: ListViewDefinition;
};

type PersonalViewEntry = PersistedPersonalViewEntry;

type PersonalViewsMeta = {
  personalViews: PersonalViewEntry[];
  activeViewId: string | null;
  defaultViewId: string | null;
};

type InternalColumnMeta<T> = {
  id: string;
  label: string;
  defaultVisible: boolean;
  lockedVisible: boolean;
  lockedOrder: boolean;
  colDef: ColDef<T>;
  originalIndex: number;
};

function storageKey(pageKey: string): string {
  return `${STORAGE_PREFIX}${pageKey}`;
}

function readRawPersisted(pageKey: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(pageKey));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writePersisted(pageKey: string, value: PersistedPersonalViewState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(pageKey), JSON.stringify(value));
  } catch {
    // ignore local storage write failures in foundation layer
  }
}

function normalizeColDefsWithStableIds<T>(defs: ColDef<T>[]): ColDef<T>[] {
  return defs.map((colDef, index) => {
    const existingId =
      typeof colDef.colId === "string" && colDef.colId.trim() !== ""
        ? colDef.colId
        : typeof colDef.field === "string" && colDef.field.trim() !== ""
          ? colDef.field
          : null;
    if (existingId) return colDef;
    return { ...colDef, colId: `__col_${index}` };
  });
}

function buildColumnMeta<T>(defs: ColDef<T>[]): InternalColumnMeta<T>[] {
  return defs.map((colDef, index) => {
    const id = colDef.colId ?? colDef.field ?? `__col_${index}`;
    const headerName = typeof colDef.headerName === "string" ? colDef.headerName.trim() : "";
    const label = headerName !== "" ? headerName : id;
    const lockedVisible = colDef.lockVisible === true || colDef.lockPosition != null;
    const lockedOrder = colDef.suppressMovable === true || colDef.lockPosition != null;
    return {
      id,
      label,
      defaultVisible: colDef.hide !== true,
      lockedVisible,
      lockedOrder,
      colDef,
      originalIndex: index,
    };
  });
}

function buildRegistryForMeta<T>(
  entityType: ListViewEntityType,
  meta: InternalColumnMeta<T>[],
  overrideRegistry?: ListViewFieldRegistryEntry[],
): ListViewFieldRegistryEntry[] {
  const sourceRegistry = overrideRegistry ?? getListViewFieldRegistry(entityType);
  const registryByKey = new Map(sourceRegistry.map((field) => [field.fieldKey, field]));
  return meta.map((entry) => {
    const reg = registryByKey.get(entry.id);
    if (reg) {
      return {
        ...reg,
        // Keep registry behavior but always display the current localized grid header inside View Configuration.
        label: entry.label,
      };
    }
    return {
      fieldKey: entry.id,
      entityType,
      label: entry.label,
      dataType: "string",
      sourceType: "derived",
      defaultVisible: entry.defaultVisible,
      lockedVisible: entry.lockedVisible,
      sortable: entry.colDef.sortable !== false,
      filterable: true,
      exportable: true,
      selectable: true,
      rendererType: "text",
      requiresPermission: null,
      performanceCost: "low",
    };
  });
}

function itemsFromDefinition<T>(
  definition: ListViewDefinition,
  meta: InternalColumnMeta<T>[],
): AgGridColumnSettingsItem[] {
  const byId = new Map(meta.map((entry) => [entry.id, entry]));
  return definition.columns
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((column) => {
      const source = byId.get(column.fieldKey);
      if (!source) return null;
      return {
        id: source.id,
        label: source.label,
        visible: source.lockedVisible ? true : column.visible,
        lockedVisible: source.lockedVisible,
        lockedOrder: source.lockedOrder,
      };
    })
    .filter((item): item is AgGridColumnSettingsItem => item !== null);
}

function sanitizeSettingsItems(items: AgGridColumnSettingsItem[]): AgGridColumnSettingsItem[] {
  return items.map((item) => (item.lockedVisible ? { ...item, visible: true } : item));
}

function columnsFromItems(items: AgGridColumnSettingsItem[]) {
  return items.map((item, index) => ({
    fieldKey: item.id,
    visible: item.lockedVisible ? true : item.visible,
    order: index,
  }));
}

function visibleFieldKeysFromColumns(columns: Array<{ fieldKey: string; visible: boolean }>): Set<string> {
  return new Set(columns.filter((column) => column.visible).map((column) => column.fieldKey));
}

function applySettingsToDefs<T>(meta: InternalColumnMeta<T>[], items: AgGridColumnSettingsItem[]): ColDef<T>[] {
  const byId = new Map(meta.map((entry) => [entry.id, entry.colDef]));
  const seen = new Set<string>();
  const ordered: ColDef<T>[] = [];
  for (const item of items) {
    const source = byId.get(item.id);
    if (!source || seen.has(item.id)) continue;
    seen.add(item.id);
    ordered.push({ ...source, hide: item.visible ? false : true });
  }
  for (const entry of [...meta].sort((a, b) => a.originalIndex - b.originalIndex)) {
    if (seen.has(entry.id)) continue;
    ordered.push({ ...entry.colDef, hide: entry.colDef.hide === true });
  }
  return ordered;
}

function normalizeDefinitionByRegistry(
  entityType: ListViewEntityType,
  registry: ListViewFieldRegistryEntry[],
  value: unknown,
  allowHiddenFilterSort?: boolean,
): ListViewDefinition | null {
  if (value == null) return null;
  const parsed = parsePersistedListViewDefinition(JSON.stringify(value));
  if (!parsed || parsed.entityType !== entityType) return null;
  return mergeListViewDefinitionWithRegistry({
    entityType,
    registry,
    persisted: parsed,
    allowHiddenFilterSort,
  });
}

function findViewById(meta: PersonalViewsMeta | null, viewId: string | null): PersonalViewEntry | null {
  if (!meta || !viewId) return null;
  return meta.personalViews.find((view) => view.viewId === viewId) ?? null;
}

function makePersistedState(
  entityType: ListViewEntityType,
  meta: PersonalViewsMeta,
  workingDefinition: ListViewDefinition,
): PersistedPersonalViewState {
  return {
    version: PERSISTED_VERSION,
    entityType,
    personalViews: meta.personalViews,
    activeViewId: meta.activeViewId,
    defaultViewId: meta.defaultViewId,
    workingDefinition,
  };
}

function sanitizePersonalViewsMeta(input: {
  entityType: ListViewEntityType;
  registry: ListViewFieldRegistryEntry[];
  systemDefaultDefinition: ListViewDefinition;
  raw: unknown;
  allowHiddenFilterSort?: boolean;
}): { meta: PersonalViewsMeta; workingDefinition: ListViewDefinition } {
  const { entityType, registry, systemDefaultDefinition, raw, allowHiddenFilterSort } = input;
  const emptyMeta: PersonalViewsMeta = {
    personalViews: [],
    activeViewId: null,
    defaultViewId: null,
  };

  if (!raw || typeof raw !== "object") {
    return { meta: emptyMeta, workingDefinition: systemDefaultDefinition };
  }

  const legacyCandidate = raw as LegacyPersistedColumnSettings;
  if ((legacyCandidate as { listViewDefinition?: unknown }).listViewDefinition) {
    const migrated = normalizeDefinitionByRegistry(
      entityType,
      registry,
      legacyCandidate.listViewDefinition,
      allowHiddenFilterSort,
    );
    return {
      meta: emptyMeta,
      workingDefinition: migrated ?? systemDefaultDefinition,
    };
  }

  const persisted = raw as PersistedPersonalViewState;
  if (persisted.version !== PERSISTED_VERSION || persisted.entityType !== entityType) {
    return { meta: emptyMeta, workingDefinition: systemDefaultDefinition };
  }

  const uniqueIds = new Set<string>();
  const personalViews: PersonalViewEntry[] = [];
  for (const entry of Array.isArray(persisted.personalViews) ? persisted.personalViews : []) {
    if (!entry || typeof entry !== "object") continue;
    const viewId = typeof entry.viewId === "string" ? entry.viewId.trim() : "";
    if (viewId === "" || uniqueIds.has(viewId)) continue;
    const normalized = normalizeDefinitionByRegistry(
      entityType,
      registry,
      entry.listViewDefinition,
      allowHiddenFilterSort,
    );
    if (!normalized) continue;
    uniqueIds.add(viewId);
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    personalViews.push({
      viewId,
      entityType,
      ownerType: "user",
      name: name === "" ? `View ${personalViews.length + 1}` : name,
      version: 1,
      listViewDefinition: normalized,
    });
  }

  const viewById = new Map(personalViews.map((view) => [view.viewId, view]));
  const defaultViewId =
    typeof persisted.defaultViewId === "string" && viewById.has(persisted.defaultViewId)
      ? persisted.defaultViewId
      : null;
  const activeViewId =
    typeof persisted.activeViewId === "string" && viewById.has(persisted.activeViewId)
      ? persisted.activeViewId
      : defaultViewId;

  const activeView = activeViewId ? viewById.get(activeViewId) ?? null : null;
  const defaultView = defaultViewId ? viewById.get(defaultViewId) ?? null : null;
  const workingDefinition =
    normalizeDefinitionByRegistry(entityType, registry, persisted.workingDefinition, allowHiddenFilterSort) ??
    activeView?.listViewDefinition ??
    defaultView?.listViewDefinition ??
    systemDefaultDefinition;

  return {
    meta: {
      personalViews,
      activeViewId,
      defaultViewId,
    },
    workingDefinition,
  };
}

function createViewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function definitionSignature(definition: ListViewDefinition | null): string {
  return definition ? JSON.stringify(definition) : "";
}

type UseAgGridColumnSettingsParams<T> = {
  pageKey: string;
  entityType: ListViewEntityType;
  baseColumnDefs: ColDef<T>[];
  fieldRegistry?: ListViewFieldRegistryEntry[];
  allowHiddenFilterSort?: boolean;
};

export type UseAgGridColumnSettingsResult<T> = {
  columnDefs: ColDef<T>[];
  committedItems: AgGridColumnSettingsItem[];
  draftItems: AgGridColumnSettingsItem[];
  setDraftItems: (updater: (prev: AgGridColumnSettingsItem[]) => AgGridColumnSettingsItem[]) => void;
  draftDeepFilters: ListViewDeepFilterRule[];
  setDraftDeepFilters: (updater: (prev: ListViewDeepFilterRule[]) => ListViewDeepFilterRule[]) => void;
  draftDeepSorts: ListViewDeepSortRule[];
  setDraftDeepSorts: (updater: (prev: ListViewDeepSortRule[]) => ListViewDeepSortRule[]) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  applyDraft: () => { hiddenIds: string[]; nextItems: AgGridColumnSettingsItem[] };
  resetDraftToDefaults: () => void;
  cancelDraft: () => void;
  deepFilterModel: AgGridColumnFilterModel;
  deepSortModel: UrlGridSort[];
  definition: ListViewDefinition | null;
  registry: ListViewFieldRegistryEntry[];
  personalViews: AgGridPersonalView[];
  activeViewId: string | null;
  activeViewName: string | null;
  hasUnsavedChanges: boolean;
  activatePersonalView: (viewId: string | null) => void;
  createPersonalViewFromCurrent: (name: string) => boolean;
  saveActivePersonalViewFromCurrent: () => boolean;
  renameActivePersonalView: (name: string) => boolean;
  deleteActivePersonalView: () => boolean;
  setActivePersonalViewAsDefault: () => boolean;
};

export function useAgGridColumnSettings<T>({
  pageKey,
  entityType,
  baseColumnDefs,
  fieldRegistry,
  allowHiddenFilterSort = false,
}: UseAgGridColumnSettingsParams<T>): UseAgGridColumnSettingsResult<T> {
  const normalizedBaseDefs = useMemo(() => normalizeColDefsWithStableIds(baseColumnDefs), [baseColumnDefs]);
  const meta = useMemo(() => buildColumnMeta(normalizedBaseDefs), [normalizedBaseDefs]);
  const registry = useMemo(
    () => buildRegistryForMeta(entityType, meta, fieldRegistry),
    [entityType, meta, fieldRegistry],
  );
  const systemDefaultDefinition = useMemo(
    () => buildDefaultListViewDefinition(entityType, registry),
    [entityType, registry],
  );

  const [definition, setDefinition] = useState<ListViewDefinition | null>(null);
  const [draftDefinition, setDraftDefinition] = useState<ListViewDefinition | null>(null);
  const [personalViewsMeta, setPersonalViewsMeta] = useState<PersonalViewsMeta | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const persistState = useCallback(
    (nextMeta: PersonalViewsMeta, nextDefinition: ListViewDefinition) => {
      writePersisted(pageKey, makePersistedState(entityType, nextMeta, nextDefinition));
    },
    [entityType, pageKey],
  );

  useEffect(() => {
    const raw = readRawPersisted(pageKey);
    const sanitized = sanitizePersonalViewsMeta({
      entityType,
      registry,
      systemDefaultDefinition,
      raw,
      allowHiddenFilterSort,
    });
    setPersonalViewsMeta(sanitized.meta);
    setDefinition(sanitized.workingDefinition);
    setDraftDefinition(sanitized.workingDefinition);
    persistState(sanitized.meta, sanitized.workingDefinition);
  }, [entityType, pageKey, persistState, registry, systemDefaultDefinition]);

  const committedItems = useMemo(
    () => (definition ? sanitizeSettingsItems(itemsFromDefinition(definition, meta)) : []),
    [definition, meta],
  );
  const draftItems = useMemo(
    () => (draftDefinition ? sanitizeSettingsItems(itemsFromDefinition(draftDefinition, meta)) : committedItems),
    [draftDefinition, committedItems, meta],
  );

  const setDraftItems = useCallback(
    (updater: (prev: AgGridColumnSettingsItem[]) => AgGridColumnSettingsItem[]) => {
      setDraftDefinition((prev) => {
        if (!prev) return prev;
        const nextItems = sanitizeSettingsItems(updater(itemsFromDefinition(prev, meta)));
        const nextColumns = columnsFromItems(nextItems);
        const previousVisible = visibleFieldKeysFromColumns(prev.columns);
        const nextVisible = visibleFieldKeysFromColumns(nextColumns);
        const hiddenIds = Array.from(previousVisible).filter((fieldKey) => !nextVisible.has(fieldKey));
        return {
          ...prev,
          columns: nextColumns,
          deepFilters: allowHiddenFilterSort ? prev.deepFilters : pruneDeepFilterRulesByHiddenFields(prev.deepFilters, hiddenIds),
          deepSorts: allowHiddenFilterSort ? prev.deepSorts : pruneDeepSortRulesByHiddenFields(prev.deepSorts, hiddenIds),
        };
      });
    },
    [allowHiddenFilterSort, meta],
  );

  const setDraftDeepFilters = useCallback(
    (updater: (prev: ListViewDeepFilterRule[]) => ListViewDeepFilterRule[]) => {
      setDraftDefinition((prev) => {
        if (!prev) return prev;
        const visibleFieldKeys = allowHiddenFilterSort ? undefined : visibleFieldKeysFromColumns(prev.columns);
        const nextRules = normalizeDeepFilterRules({
          rules: updater(prev.deepFilters),
          registry,
          visibleFieldKeys,
        });
        return {
          ...prev,
          deepFilters: nextRules,
        };
      });
    },
    [allowHiddenFilterSort, registry],
  );

  const setDraftDeepSorts = useCallback(
    (updater: (prev: ListViewDeepSortRule[]) => ListViewDeepSortRule[]) => {
      setDraftDefinition((prev) => {
        if (!prev) return prev;
        const visibleFieldKeys = allowHiddenFilterSort ? undefined : visibleFieldKeysFromColumns(prev.columns);
        const nextRules = normalizeDeepSortRules({
          rules: updater(prev.deepSorts),
          registry,
          visibleFieldKeys,
        });
        return {
          ...prev,
          deepSorts: nextRules,
        };
      });
    },
    [allowHiddenFilterSort, registry],
  );

  const openSettings = useCallback(() => {
    setDraftDefinition(definition);
    setSettingsOpen(true);
  }, [definition]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraftDefinition(definition);
    setSettingsOpen(false);
  }, [definition]);

  const applyDraft = useCallback(() => {
    const currentDefinition = definition;
    const currentMeta = personalViewsMeta;
    if (!currentDefinition || !draftDefinition || !currentMeta) {
      return { hiddenIds: [], nextItems: committedItems };
    }

    const mergedDraft = mergeListViewDefinitionWithRegistry({
      entityType,
      registry,
      persisted: draftDefinition,
      allowHiddenFilterSort,
    });
    const nextCommitted = sanitizeSettingsItems(itemsFromDefinition(mergedDraft, meta));
    const prevVisible = visibleFieldKeysFromColumns(currentDefinition.columns);
    const nextVisible = visibleFieldKeysFromColumns(mergedDraft.columns);
    const hiddenIds = Array.from(prevVisible).filter((id) => !nextVisible.has(id));
    const nextDefinition: ListViewDefinition = {
      ...mergedDraft,
      deepFilters: allowHiddenFilterSort ? mergedDraft.deepFilters : pruneDeepFilterRulesByHiddenFields(mergedDraft.deepFilters, hiddenIds),
      deepSorts: allowHiddenFilterSort ? mergedDraft.deepSorts : pruneDeepSortRulesByHiddenFields(mergedDraft.deepSorts, hiddenIds),
    };

    setDefinition(nextDefinition);
    setDraftDefinition(nextDefinition);
    setSettingsOpen(false);
    persistState(currentMeta, nextDefinition);
    return { hiddenIds, nextItems: nextCommitted };
  }, [allowHiddenFilterSort, committedItems, definition, draftDefinition, entityType, meta, persistState, personalViewsMeta, registry]);

  const resetDraftToDefaults = useCallback(() => {
    const currentMeta = personalViewsMeta;
    if (!currentMeta) {
      setDraftDefinition(systemDefaultDefinition);
      return;
    }
    const baseline =
      findViewById(currentMeta, currentMeta.activeViewId)?.listViewDefinition ??
      findViewById(currentMeta, currentMeta.defaultViewId)?.listViewDefinition ??
      systemDefaultDefinition;
    setDraftDefinition(baseline);
  }, [personalViewsMeta, systemDefaultDefinition]);

  const activatePersonalView = useCallback(
    (viewId: string | null) => {
      const currentMeta = personalViewsMeta;
      const currentDefinition = definition;
      if (!currentMeta || !currentDefinition) return;

      if (!viewId) {
        const nextMeta: PersonalViewsMeta = { ...currentMeta, activeViewId: null };
        setPersonalViewsMeta(nextMeta);
        persistState(nextMeta, currentDefinition);
        return;
      }

      const nextView = currentMeta.personalViews.find((view) => view.viewId === viewId);
      if (!nextView) return;
      const nextMeta: PersonalViewsMeta = { ...currentMeta, activeViewId: nextView.viewId };
      setPersonalViewsMeta(nextMeta);
      setDefinition(nextView.listViewDefinition);
      setDraftDefinition(nextView.listViewDefinition);
      persistState(nextMeta, nextView.listViewDefinition);
    },
    [definition, persistState, personalViewsMeta],
  );

  const createPersonalViewFromCurrent = useCallback(
    (name: string): boolean => {
      const currentMeta = personalViewsMeta;
      const currentDefinition = definition;
      if (!currentMeta || !currentDefinition) return false;
      const trimmedName = name.trim();
      if (trimmedName === "") return false;
      const nextView: PersonalViewEntry = {
        viewId: createViewId(),
        entityType,
        ownerType: "user",
        name: trimmedName,
        version: 1,
        listViewDefinition: currentDefinition,
      };
      const nextMeta: PersonalViewsMeta = {
        personalViews: [...currentMeta.personalViews, nextView],
        activeViewId: nextView.viewId,
        defaultViewId: currentMeta.defaultViewId ?? nextView.viewId,
      };
      setPersonalViewsMeta(nextMeta);
      persistState(nextMeta, currentDefinition);
      return true;
    },
    [definition, entityType, persistState, personalViewsMeta],
  );

  const saveActivePersonalViewFromCurrent = useCallback((): boolean => {
    const currentMeta = personalViewsMeta;
    const currentDefinition = definition;
    if (!currentMeta || !currentDefinition || !currentMeta.activeViewId) return false;
    let updated = false;
    const nextViews = currentMeta.personalViews.map((view) => {
      if (view.viewId !== currentMeta.activeViewId) return view;
      updated = true;
      return { ...view, listViewDefinition: currentDefinition };
    });
    if (!updated) return false;
    const nextMeta: PersonalViewsMeta = { ...currentMeta, personalViews: nextViews };
    setPersonalViewsMeta(nextMeta);
    persistState(nextMeta, currentDefinition);
    return true;
  }, [definition, persistState, personalViewsMeta]);

  const renameActivePersonalView = useCallback(
    (name: string): boolean => {
      const currentMeta = personalViewsMeta;
      const currentDefinition = definition;
      if (!currentMeta || !currentDefinition || !currentMeta.activeViewId) return false;
      const trimmedName = name.trim();
      if (trimmedName === "") return false;
      let updated = false;
      const nextViews = currentMeta.personalViews.map((view) => {
        if (view.viewId !== currentMeta.activeViewId) return view;
        updated = true;
        return { ...view, name: trimmedName };
      });
      if (!updated) return false;
      const nextMeta: PersonalViewsMeta = { ...currentMeta, personalViews: nextViews };
      setPersonalViewsMeta(nextMeta);
      persistState(nextMeta, currentDefinition);
      return true;
    },
    [definition, persistState, personalViewsMeta],
  );

  const deleteActivePersonalView = useCallback((): boolean => {
    const currentMeta = personalViewsMeta;
    const currentDefinition = definition;
    if (!currentMeta || !currentDefinition || !currentMeta.activeViewId) return false;

    const removingViewId = currentMeta.activeViewId;
    const remainingViews = currentMeta.personalViews.filter((view) => view.viewId !== removingViewId);
    const remainingById = new Map(remainingViews.map((view) => [view.viewId, view]));

    const nextDefaultId =
      currentMeta.defaultViewId && currentMeta.defaultViewId !== removingViewId && remainingById.has(currentMeta.defaultViewId)
        ? currentMeta.defaultViewId
        : null;
    const nextActiveId = nextDefaultId ?? remainingViews[0]?.viewId ?? null;
    const fallbackDefinition =
      (nextActiveId ? remainingById.get(nextActiveId)?.listViewDefinition : null) ?? systemDefaultDefinition;

    const nextMeta: PersonalViewsMeta = {
      personalViews: remainingViews,
      activeViewId: nextActiveId,
      defaultViewId: nextDefaultId,
    };

    setPersonalViewsMeta(nextMeta);
    setDefinition(fallbackDefinition);
    setDraftDefinition(fallbackDefinition);
    persistState(nextMeta, fallbackDefinition);
    return true;
  }, [definition, persistState, personalViewsMeta, systemDefaultDefinition]);

  const setActivePersonalViewAsDefault = useCallback((): boolean => {
    const currentMeta = personalViewsMeta;
    const currentDefinition = definition;
    if (!currentMeta || !currentDefinition || !currentMeta.activeViewId) return false;
    if (!currentMeta.personalViews.some((view) => view.viewId === currentMeta.activeViewId)) return false;
    const nextMeta: PersonalViewsMeta = {
      ...currentMeta,
      defaultViewId: currentMeta.activeViewId,
    };
    setPersonalViewsMeta(nextMeta);
    persistState(nextMeta, currentDefinition);
    return true;
  }, [definition, persistState, personalViewsMeta]);

  const activeView = useMemo(
    () => findViewById(personalViewsMeta, personalViewsMeta?.activeViewId ?? null),
    [personalViewsMeta],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!activeView || !definition) return false;
    return definitionSignature(activeView.listViewDefinition) !== definitionSignature(definition);
  }, [activeView, definition]);

  const personalViews = useMemo<AgGridPersonalView[]>(
    () =>
      (personalViewsMeta?.personalViews ?? []).map((view) => ({
        viewId: view.viewId,
        name: view.name,
        isDefault: personalViewsMeta?.defaultViewId === view.viewId,
        isActive: personalViewsMeta?.activeViewId === view.viewId,
      })),
    [personalViewsMeta],
  );

  const columnDefs = useMemo(() => applySettingsToDefs(meta, committedItems), [meta, committedItems]);
  const deepFilterModel = useMemo(
    () => buildAgGridModelFromDeepFilterRules(definition?.deepFilters ?? []),
    [definition?.deepFilters],
  );
  const deepSortModel = useMemo(
    () => buildUrlGridSortFromDeepSortRules(definition?.deepSorts ?? []),
    [definition?.deepSorts],
  );

  return {
    columnDefs,
    committedItems,
    draftItems,
    setDraftItems,
    draftDeepFilters: draftDefinition?.deepFilters ?? [],
    setDraftDeepFilters,
    draftDeepSorts: draftDefinition?.deepSorts ?? [],
    setDraftDeepSorts,
    settingsOpen,
    openSettings,
    closeSettings,
    applyDraft,
    resetDraftToDefaults,
    cancelDraft,
    deepFilterModel,
    deepSortModel,
    definition,
    registry,
    personalViews,
    activeViewId: personalViewsMeta?.activeViewId ?? null,
    activeViewName: activeView?.name ?? null,
    hasUnsavedChanges,
    activatePersonalView,
    createPersonalViewFromCurrent,
    saveActivePersonalViewFromCurrent,
    renameActivePersonalView,
    deleteActivePersonalView,
    setActivePersonalViewAsDefault,
  };
}
