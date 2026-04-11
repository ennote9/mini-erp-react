import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";

const STORAGE_PREFIX = "mini-erp:grid-columns:v1:";

export type AgGridColumnSettingsItem = {
  id: string;
  label: string;
  visible: boolean;
  lockedVisible: boolean;
  lockedOrder: boolean;
};

type PersistedColumnSettings = {
  items: Array<{ id: string; visible: boolean }>;
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

function readPersisted(pageKey: string): PersistedColumnSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(pageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedColumnSettings;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(pageKey: string, value: PersistedColumnSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(pageKey), JSON.stringify(value));
  } catch {
    // ignore storage write failures in MVP
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
    return {
      ...colDef,
      colId: `__col_${index}`,
    };
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

function mergePersistedWithMeta<T>(
  meta: InternalColumnMeta<T>[],
  persisted: PersistedColumnSettings | null,
): AgGridColumnSettingsItem[] {
  const byId = new Map(meta.map((x) => [x.id, x]));
  const ordered: AgGridColumnSettingsItem[] = [];
  const seen = new Set<string>();

  if (persisted) {
    for (const item of persisted.items) {
      const source = byId.get(item.id);
      if (!source || seen.has(source.id)) continue;
      seen.add(source.id);
      ordered.push({
        id: source.id,
        label: source.label,
        visible: source.lockedVisible ? true : item.visible,
        lockedVisible: source.lockedVisible,
        lockedOrder: source.lockedOrder,
      });
    }
  }

  const missing = meta
    .filter((x) => !seen.has(x.id))
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map((x) => ({
      id: x.id,
      label: x.label,
      visible: x.defaultVisible,
      lockedVisible: x.lockedVisible,
      lockedOrder: x.lockedOrder,
    }));

  return [...ordered, ...missing];
}

function sanitizeSettingsItems(items: AgGridColumnSettingsItem[]): AgGridColumnSettingsItem[] {
  return items.map((item) =>
    item.lockedVisible
      ? {
          ...item,
          visible: true,
        }
      : item,
  );
}

function applySettingsToDefs<T>(
  meta: InternalColumnMeta<T>[],
  items: AgGridColumnSettingsItem[],
): ColDef<T>[] {
  const byId = new Map(meta.map((x) => [x.id, x.colDef]));
  const result: ColDef<T>[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const source = byId.get(item.id);
    if (!source || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push({
      ...source,
      hide: item.visible ? false : true,
    });
  }

  for (const entry of meta.sort((a, b) => a.originalIndex - b.originalIndex)) {
    if (seen.has(entry.id)) continue;
    result.push({
      ...entry.colDef,
      hide: entry.colDef.hide === true,
    });
  }

  return result;
}

type UseAgGridColumnSettingsParams<T> = {
  pageKey: string;
  baseColumnDefs: ColDef<T>[];
};

export type UseAgGridColumnSettingsResult<T> = {
  columnDefs: ColDef<T>[];
  committedItems: AgGridColumnSettingsItem[];
  draftItems: AgGridColumnSettingsItem[];
  setDraftItems: (updater: (prev: AgGridColumnSettingsItem[]) => AgGridColumnSettingsItem[]) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  applyDraft: () => { hiddenIds: string[]; nextItems: AgGridColumnSettingsItem[] };
  resetDraftToDefaults: () => void;
  cancelDraft: () => void;
};

export function useAgGridColumnSettings<T>({
  pageKey,
  baseColumnDefs,
}: UseAgGridColumnSettingsParams<T>): UseAgGridColumnSettingsResult<T> {
  const normalizedBaseDefs = useMemo(() => normalizeColDefsWithStableIds(baseColumnDefs), [baseColumnDefs]);
  const meta = useMemo(() => buildColumnMeta(normalizedBaseDefs), [normalizedBaseDefs]);

  const defaults = useMemo(() => mergePersistedWithMeta(meta, null), [meta]);
  const [committedItems, setCommittedItems] = useState<AgGridColumnSettingsItem[]>(defaults);
  const [draftItems, setDraftItemsState] = useState<AgGridColumnSettingsItem[]>(defaults);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const persisted = readPersisted(pageKey);
    const next = sanitizeSettingsItems(mergePersistedWithMeta(meta, persisted));
    setCommittedItems(next);
    setDraftItemsState(next);
  }, [meta, pageKey]);

  const setDraftItems = useCallback(
    (updater: (prev: AgGridColumnSettingsItem[]) => AgGridColumnSettingsItem[]) => {
      setDraftItemsState((prev) => sanitizeSettingsItems(updater(prev)));
    },
    [],
  );

  const openSettings = useCallback(() => {
    setDraftItemsState(committedItems);
    setSettingsOpen(true);
  }, [committedItems]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraftItemsState(committedItems);
    setSettingsOpen(false);
  }, [committedItems]);

  const applyDraft = useCallback(() => {
    const nextCommitted = sanitizeSettingsItems(draftItems);
    const prevVisible = new Set(committedItems.filter((x) => x.visible).map((x) => x.id));
    const nextVisible = new Set(nextCommitted.filter((x) => x.visible).map((x) => x.id));
    const hiddenIds = Array.from(prevVisible).filter((id) => !nextVisible.has(id));
    setCommittedItems(nextCommitted);
    writePersisted(pageKey, {
      items: nextCommitted.map((x) => ({ id: x.id, visible: x.visible })),
    });
    setSettingsOpen(false);
    return { hiddenIds, nextItems: nextCommitted };
  }, [committedItems, draftItems, pageKey]);

  const resetDraftToDefaults = useCallback(() => {
    setDraftItemsState(defaults);
  }, [defaults]);

  const columnDefs = useMemo(() => applySettingsToDefs(meta, committedItems), [meta, committedItems]);

  return {
    columnDefs,
    committedItems,
    draftItems,
    setDraftItems,
    settingsOpen,
    openSettings,
    closeSettings,
    applyDraft,
    resetDraftToDefaults,
    cancelDraft,
  };
}
