/**
 * Items list — first TanStack Table pilot renderer.
 * Keeps current search/view/persistence semantics while replacing AG Grid as the active renderer for /items.
 */
import {
  functionalUpdate,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ensureItemsLoaded, isItemsRepositoryReady, itemRepository } from "../repository";
import type { Item } from "../model";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import {
  applyListViewColumnFilters,
  applyDeepSortModel,
  useListViewColumnSettings,
  ListViewColumnSettingsModal,
  hasMeaningfulTextSelection,
  type ListViewColumnFilterConfig,
} from "../../../shared/ui/list-view";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, SlidersHorizontal, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { itemsListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { useAppDisplayFormatters } from "@/shared/formatting";
import {
  isMarkdownCodeFormat,
  resolveMarkdownRecordByScanInput,
} from "@/modules/markdown-journal";
import { readListViewUrlSort, serializeListViewUrlSort, type ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import {
  readUrlListViewColumnFilters,
  withUrlListViewColumnFilters,
} from "@/shared/navigation/listViewColumnFilters";
import {
  buildListViewUrlSortFromDeepSortRules,
  pruneDeepSortRulesByHiddenFields,
  type ListViewDeepFilterRule,
} from "@/shared/ui/list-view/listViewConfig";
import { buildItemsListViewCatalog } from "../listViewFieldCatalog";
import { buildItemListRows, type ItemListRow } from "../listViewRowModel";
import { buildItemsTableSchema, type ItemsTableColumnSchema } from "../itemsTableSchema";
import { buildItemsTableListViewState } from "../itemsListViewState";
import { formatItemsTableValue } from "../itemsTanstackColumns";
import { ItemsTanstackTable } from "../ItemsTanstackTable";
import { ItemsHeaderFilterPanel } from "../ItemsHeaderFilterPanel";
import { ItemsModuleLayout } from "../components/ItemsModuleLayout";

const COLUMN_SIZING_STORAGE_KEY = "mini-erp:items:tanstack:columnSizing:v1";
const MAX_REASONABLE_COLUMN_SIZE = 1200;

type HeaderFilterAnchor = {
  fieldId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type PendingHeaderFilterCommit =
  | {
      type: "apply";
      rule: ListViewDeepFilterRule;
    }
  | {
      type: "reset";
      fieldKey: string;
    };

function applyBrandIdFilter(items: Item[], brandId: string | null): Item[] {
  if (brandId == null || brandId === "") return items;
  return items.filter((x) => x.brandId === brandId);
}

function applyCategoryIdFilter(items: Item[], categoryId: string | null): Item[] {
  if (categoryId == null || categoryId === "") return items;
  return items.filter((x) => x.categoryId === categoryId);
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

/** True when the page runs inside the Tauri webview (not a standalone browser tab on the dev server). */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Opt-in: add `?exportDiag=1` on `/items` — logs stages + runs Case A (minimal txt download) before real export. */
function itemsExportDiagLog(enabled: boolean, message: string, detail?: unknown) {
  if (!enabled) return;
  console.info("[items-export]", message, detail ?? "");
}

/**
 * Browser download (plain `npm run dev`) or fallback when Tauri `save()` is dismissed / native write fails.
 *
 * Important: many browsers ignore `click()` on a detached `<a>`, and revoking the blob URL immediately
 * can cancel the download before it starts. Append to `document.body`, click, remove, revoke later.
 */
function downloadBufferInBrowser(
  data: BlobPart,
  downloadFilename: string,
  mimeType: string,
  exportDiag = false,
) {
  itemsExportDiagLog(exportDiag, "browser download helper entered", { downloadFilename, mimeType });
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadFilename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
  itemsExportDiagLog(exportDiag, "browser download helper completed", { downloadFilename });
}

/** ExcelJS `writeBuffer()` can resolve to `ArrayBuffer` or a typed array view depending on bundler/runtime. */
function coerceWriteBufferResult(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as DataView | Uint8Array | Int8Array;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer;
  }
  throw new Error(`[items-export] unexpected workbook buffer type: ${Object.prototype.toString.call(data)}`);
}

function readPersistedColumnSizing(): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ColumnSizingState;
  } catch {
    return {};
  }
}

function writePersistedColumnSizing(value: ColumnSizingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore localStorage failures for pilot renderer sizing persistence
  }
}

function sanitizeColumnSizing(
  value: ColumnSizingState,
  schema: ItemsTableColumnSchema[],
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

export function ItemsListPage() {
  const { t, locale } = useTranslation();
  const { formatMoney } = useAppDisplayFormatters();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const brandFilterId = useMemo(() => {
    const raw = searchParams.get("brandId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
  const categoryFilterId = useMemo(() => {
    const raw = searchParams.get("categoryId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
  const searchQuery = searchParams.get("q") ?? "";
  const searchParamsSort = searchParams.get("sort") ?? "";
  const appReadRevision = useAppReadModelRevision();
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingSortModel, setPendingSortModel] = useState<ListViewUrlSort[] | null>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => readPersistedColumnSizing());
  const [itemsReady, setItemsReady] = useState(() => isItemsRepositoryReady());
  const [headerFilterAnchor, setHeaderFilterAnchor] = useState<HeaderFilterAnchor | null>(null);
  const [pendingHeaderFilterCommit, setPendingHeaderFilterCommit] = useState<PendingHeaderFilterCommit | null>(null);
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState(() =>
    serializeListViewUrlSort(readListViewUrlSort(new URLSearchParams(location.search))),
  );
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  useEffect(() => {
    writePersistedColumnSizing(columnSizing);
  }, [columnSizing]);

  useEffect(() => {
    if (itemsReady) return;
    let cancelled = false;
    ensureItemsLoaded()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setItemsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itemsReady]);

  const listStateKey = useMemo(
    () => buildNavigationStateKey(location.pathname, searchParams),
    [location.pathname, searchParams],
  );
  useSessionScrollRestore(listStateKey, gridContainerRef);

  const currentReturnTo = useMemo(
    () => buildReturnToValue(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const columnFilterModel = useMemo(
    () => readUrlListViewColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      replaceQueryParam(searchParams, setSearchParams, "q", value);
    },
    [searchParams, setSearchParams],
  );

  const filteredItems = useMemo(() => {
    if (!itemsReady) return [];
    const searched = itemRepository.search(searchQuery);
    const brandFiltered = applyBrandIdFilter(searched, brandFilterId);
    return applyCategoryIdFilter(brandFiltered, categoryFilterId);
  }, [itemsReady, searchQuery, brandFilterId, categoryFilterId, appReadRevision]);

  const listRows = useMemo(
    () =>
      itemsReady
        ? buildItemListRows({
            items: filteredItems,
            brands: brandRepository.list(),
            categories: categoryRepository.list(),
          })
        : [],
    [itemsReady, filteredItems, appReadRevision],
  );

  const itemsListViewCatalog = useMemo(
    () =>
      buildItemsListViewCatalog({
        t,
        formatMoney,
      }),
    [t, locale, formatMoney, appReadRevision],
  );
  const itemsTableSchema = useMemo(
    () => buildItemsTableSchema({ t }),
    [t, locale, appReadRevision],
  );

  useEffect(() => {
    setColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, itemsTableSchema);
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [itemsTableSchema]);

  const baseColumnDefs = itemsListViewCatalog.columnDefs;
  const itemFieldRegistry = itemsListViewCatalog.fieldRegistry;
  const itemColumnFilterConfigs = itemsListViewCatalog.filterConfigs;

  const displayItemsWithQueryFilters = useMemo(
    () => applyListViewColumnFilters(listRows, columnFilterModel, itemColumnFilterConfigs),
    [listRows, columnFilterModel, itemColumnFilterConfigs],
  );

  const markdownScanMatch = useMemo(() => {
    const q = searchQuery.trim();
    if (!isMarkdownCodeFormat(q)) return null;
    return resolveMarkdownRecordByScanInput(q);
  }, [searchQuery, appReadRevision]);
  const markdownCodeNoRecord = useMemo(() => {
    const q = searchQuery.trim();
    if (!isMarkdownCodeFormat(q)) return false;
    return resolveMarkdownRecordByScanInput(q) == null;
  }, [searchQuery, appReadRevision]);

  const brandFilterLabel = useMemo((): string => {
    if (brandFilterId == null) return "";
    const brand = brandRepository.getById(brandFilterId);
    if (brand) return brand.name || brand.code || brandFilterId;
    return brandFilterId;
  }, [brandFilterId]);
  const categoryFilterLabel = useMemo((): string => {
    if (categoryFilterId == null) return "";
    const category = categoryRepository.getById(categoryFilterId);
    if (category) return category.name || category.code || categoryFilterId;
    return categoryFilterId;
  }, [categoryFilterId]);

  const clearBrandFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("brandId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearCategoryFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoryId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    draftItems: columnSettingsDraftItems,
    draftDeepFilters: columnSettingsDraftDeepFilters,
    draftDeepSorts: columnSettingsDraftDeepSorts,
    settingsOpen: columnSettingsOpen,
    openSettings: openColumnSettings,
    setDraftItems: setColumnSettingsDraftItems,
    setDraftDeepFilters: setColumnSettingsDraftDeepFilters,
    setDraftDeepSorts: setColumnSettingsDraftDeepSorts,
    applyDraft: applyColumnSettingsDraft,
    resetDraftToDefaults: resetColumnSettingsDraftToDefaults,
    cancelDraft: cancelColumnSettingsDraft,
    deepFilterModel,
    deepSortModel,
    definition: columnSettingsDefinition,
    registry: columnSettingsRegistry,
    personalViews: columnSettingsPersonalViews,
    activeViewId: columnSettingsActiveViewId,
    activeViewName: columnSettingsActiveViewName,
    hasUnsavedChanges: columnSettingsHasUnsavedChanges,
    activatePersonalView: activateColumnSettingsPersonalView,
    createPersonalViewFromCurrent: createColumnSettingsPersonalViewFromCurrent,
    saveActivePersonalViewFromCurrent: saveColumnSettingsActivePersonalViewFromCurrent,
    renameActivePersonalView: renameColumnSettingsActivePersonalView,
    deleteActivePersonalView: deleteColumnSettingsActivePersonalView,
    setActivePersonalViewAsDefault: setColumnSettingsActivePersonalViewAsDefault,
  } = useListViewColumnSettings<ItemListRow>({
    pageKey: "items",
    entityType: "items",
    baseColumnDefs,
    fieldRegistry: itemFieldRegistry,
    allowHiddenFilterSort: true,
  });

  const effectiveSortModel = useMemo(() => {
    if (pendingSortModel) return pendingSortModel;
    const urlSort = readListViewUrlSort(new URLSearchParams(searchParamsSort ? `sort=${searchParamsSort}` : ""));
    const runtimeSort =
      runtimeSortSerialized === ""
        ? []
        : readListViewUrlSort(new URLSearchParams(`sort=${runtimeSortSerialized}`));
    if (runtimeSort.length > 0 && runtimeSortSerialized !== searchParamsSort) return runtimeSort;
    if (urlSort.length > 0) return urlSort;
    if (runtimeSort.length > 0) return runtimeSort;
    return deepSortModel;
  }, [pendingSortModel, searchParamsSort, runtimeSortSerialized, deepSortModel]);

  const resolveDeepSortValue = useCallback(
    (item: ItemListRow, fieldKey: string): unknown => {
      const config = itemColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(item);
      return (item as unknown as Record<string, unknown>)[fieldKey];
    },
    [itemColumnFilterConfigs],
  );

  const displayItemsWithDeepFilters = useMemo(
    () => applyListViewColumnFilters(displayItemsWithQueryFilters, deepFilterModel, itemColumnFilterConfigs),
    [displayItemsWithQueryFilters, deepFilterModel, itemColumnFilterConfigs],
  );

  const displayItems = useMemo(
    () =>
      applyDeepSortModel({
        rows: displayItemsWithDeepFilters,
        sortModel: effectiveSortModel,
        getFieldValue: resolveDeepSortValue,
      }),
    [displayItemsWithDeepFilters, effectiveSortModel, resolveDeepSortValue],
  );

  useEffect(() => {
    if (deepSortModel.length === 0) return;
    const nextSerialized = serializeListViewUrlSort(deepSortModel);
    if (nextSerialized === searchParamsSort) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", nextSerialized);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSerialized);
  }, [deepSortModel, searchParams, searchParamsSort, setSearchParams]);

  useEffect(() => {
    if (!pendingSortModel) return;
    const pendingSerialized = serializeListViewUrlSort(pendingSortModel);
    if (pendingSerialized === searchParamsSort) {
      setPendingSortModel(null);
    }
  }, [pendingSortModel, searchParamsSort]);

  const neutralListViewState = useMemo(
    () =>
      buildItemsTableListViewState({
        definition: columnSettingsDefinition,
        columnFilterModel,
        sortModel: effectiveSortModel,
        personalViews: columnSettingsPersonalViews,
        activeViewId: columnSettingsActiveViewId,
      }),
    [
      columnSettingsDefinition,
      columnFilterModel,
      effectiveSortModel,
      columnSettingsPersonalViews,
      columnSettingsActiveViewId,
    ],
  );

  const fallbackColumnVisibility = useMemo<VisibilityState>(
    () =>
      Object.fromEntries(
        itemsTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [itemsTableSchema],
  );
  const fallbackColumnOrder = useMemo(
    () => itemsTableSchema.map((column) => column.id),
    [itemsTableSchema],
  );

  const tableColumnVisibility = useMemo<VisibilityState>(() => {
    const visibility = neutralListViewState.columnVisibility;
    return Object.keys(visibility).length > 0 ? visibility : fallbackColumnVisibility;
  }, [neutralListViewState.columnVisibility, fallbackColumnVisibility]);

  const tableColumnOrder = useMemo(
    () => (neutralListViewState.columnOrder.length > 0 ? neutralListViewState.columnOrder : fallbackColumnOrder),
    [neutralListViewState.columnOrder, fallbackColumnOrder],
  );
  const registryByFieldKey = useMemo(
    () => new Map(columnSettingsRegistry.map((entry) => [entry.fieldKey, entry])),
    [columnSettingsRegistry],
  );
  const activeDeepFilterFieldState = useMemo(
    () => {
      const activeFieldMap: Record<string, boolean> = {};
      for (const rule of columnSettingsDefinition?.deepFilters ?? []) {
        if (rule.enabled !== true) continue;
        activeFieldMap[rule.fieldKey] = true;
      }
      return activeFieldMap;
    },
    [columnSettingsDefinition],
  );
  const appliedRuleByFieldKey = useMemo(() => {
    const map = new Map<string, ListViewDeepFilterRule>();
    for (const rule of columnSettingsDefinition?.deepFilters ?? []) {
      if (!map.has(rule.fieldKey)) map.set(rule.fieldKey, rule);
    }
    return map;
  }, [columnSettingsDefinition]);
  const activeHeaderFilterField = headerFilterAnchor?.fieldId ?? null;
  const activeHeaderFilterRegistryField = activeHeaderFilterField
    ? registryByFieldKey.get(activeHeaderFilterField) ?? null
    : null;
  const activeHeaderFilterConfig =
    activeHeaderFilterField != null ? itemColumnFilterConfigs[activeHeaderFilterField] : undefined;
  const activeHeaderFilterRule =
    activeHeaderFilterField != null ? appliedRuleByFieldKey.get(activeHeaderFilterField) ?? null : null;

  const tanstackSorting = useMemo<SortingState>(
    () =>
      neutralListViewState.sorting.map((entry) => ({
        id: entry.id,
        desc: entry.direction === "desc",
      })),
    [neutralListViewState.sorting],
  );

  const handleTanstackSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const nextSorting = functionalUpdate(updater, tanstackSorting);
      const nextSortModel = nextSorting.map((entry) => ({
        colId: entry.id,
        sort: entry.desc ? "desc" : "asc",
      })) as ListViewUrlSort[];
      const nextValue = serializeListViewUrlSort(nextSortModel);
      setPendingSortModel(nextSortModel);
      setRuntimeSortSerialized(nextValue);
      replaceQueryParam(searchParams, setSearchParams, "sort", nextValue);
    },
    [tanstackSorting, searchParams, setSearchParams],
  );

  const handleColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((current) => {
        const next = sanitizeColumnSizing(functionalUpdate(updater, current), itemsTableSchema);
        return next;
      });
    },
    [itemsTableSchema],
  );

  const handleApplyColumnSettings = useCallback(() => {
    const { hiddenIds } = applyColumnSettingsDraft();
    const prunedDraftDeepSorts = pruneDeepSortRulesByHiddenFields(
      columnSettingsDraftDeepSorts,
      hiddenIds,
    );
    const nextDeepSortModel = buildListViewUrlSortFromDeepSortRules(prunedDraftDeepSorts);
    const nextDeepSortSerialized = serializeListViewUrlSort(nextDeepSortModel);
    const currentDeepSortSerialized = serializeListViewUrlSort(deepSortModel);
    const currentRuntimeSortSerialized = searchParamsSort;
    const deepSortsChanged = nextDeepSortSerialized !== currentDeepSortSerialized;
    const shouldSyncToDeepSort =
      nextDeepSortModel.length > 0 && currentRuntimeSortSerialized !== nextDeepSortSerialized;
    const runtimeUsesDeepSort =
      (currentRuntimeSortSerialized === "" && deepSortModel.length > 0) ||
      currentRuntimeSortSerialized === currentDeepSortSerialized;

    let nextSortModel = effectiveSortModel;
    if (deepSortsChanged || shouldSyncToDeepSort) {
      if (nextDeepSortModel.length > 0) {
        nextSortModel = nextDeepSortModel;
      } else if (runtimeUsesDeepSort) {
        nextSortModel = [];
      }
    } else if (hiddenIds.length > 0) {
      nextSortModel = effectiveSortModel.filter((entry) => !hiddenIds.includes(entry.colId));
    }

    let nextParams = new URLSearchParams(searchParams);
    if (hiddenIds.length > 0) {
      const nextColumnFilterModel = { ...columnFilterModel };
      for (const colId of hiddenIds) delete nextColumnFilterModel[colId];
      nextParams = withUrlListViewColumnFilters(nextParams, nextColumnFilterModel);
    }

    const nextSortSerialized = serializeListViewUrlSort(nextSortModel);
    if (nextSortSerialized === "") nextParams.delete("sort");
    else nextParams.set("sort", nextSortSerialized);

    setPendingSortModel(nextSortModel);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSortSerialized);
  }, [
    applyColumnSettingsDraft,
    columnFilterModel,
    columnSettingsDraftDeepSorts,
    deepSortModel,
    effectiveSortModel,
    searchParams,
    searchParamsSort,
    setSearchParams,
  ]);

  const handleHeaderFilterApply = useCallback(
    (nextRule: ListViewDeepFilterRule) => {
      setColumnSettingsDraftDeepFilters((prev) => {
        const others = prev.filter((rule) => rule.fieldKey !== nextRule.fieldKey);
        return [
          ...others,
          {
            ...nextRule,
            priority: others.length,
          },
        ];
      });
      setHeaderFilterAnchor(null);
      setPendingHeaderFilterCommit({ type: "apply", rule: nextRule });
    },
    [setColumnSettingsDraftDeepFilters],
  );

  const handleHeaderFilterReset = useCallback(() => {
    if (!activeHeaderFilterField) return;
    setColumnSettingsDraftDeepFilters((prev) => prev.filter((rule) => rule.fieldKey !== activeHeaderFilterField));
    setHeaderFilterAnchor(null);
    setPendingHeaderFilterCommit({ type: "reset", fieldKey: activeHeaderFilterField });
  }, [activeHeaderFilterField, setColumnSettingsDraftDeepFilters]);

  useEffect(() => {
    if (!pendingHeaderFilterCommit) return;
    handleApplyColumnSettings();
    setPendingHeaderFilterCommit(null);
  }, [handleApplyColumnSettings, pendingHeaderFilterCommit]);

  const visibleSchemaColumns = useMemo(() => {
    const schemaById = new Map(itemsTableSchema.map((column) => [column.id, column]));
    return tableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is ItemsTableColumnSchema => Boolean(column))
      .filter((column) => tableColumnVisibility[column.id] !== false);
  }, [itemsTableSchema, tableColumnOrder, tableColumnVisibility]);

  const buildExportPayloadForRows = useCallback(
    (rows: ItemListRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = rows.map((row, index) =>
        visibleSchemaColumns.map((column) =>
          formatItemsTableValue({
            column,
            value: column.id === "lineNo" ? index + 1 : row[column.accessorKey ?? "code"],
            t,
            formatMoney,
            rowIndex: index,
          }),
        ),
      );

      return {
        headers: visibleSchemaColumns.map((column) => column.label),
        rows: rowsOut,
      };
    },
    [visibleSchemaColumns, t, formatMoney],
  );

  const buildExportPayload = useCallback(
    (): { headers: string[]; rows: Array<Array<string | number>> } => buildExportPayloadForRows(displayItems),
    [buildExportPayloadForRows, displayItems],
  );

  const runExportWithSaveAs = useCallback(
    async (
      defaultFilename: string,
      buildBuffer: () => Promise<ArrayBuffer | Uint8Array>,
      exportDiag = false,
    ) => {
      const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
      const base = defaultFilename.replace(/\.[^.]+$/, "");
      const generatedFilename = buildReadableUniqueFilename({ base, extension });
      const fallbackMime = extension === "pdf" ? PDF_MIME : XLSX_MIME;
      const tauri = isTauriRuntime();
      itemsExportDiagLog(exportDiag, "runtime branch chosen", { isTauriRuntime: tauri });

      // Plain Vite dev (`npm run dev`): no Tauri IPC — never call `save()` (it can throw or no-op before fallback).
      if (!tauri) {
        itemsExportDiagLog(exportDiag, "native save path skipped (browser/dev)");
        try {
          itemsExportDiagLog(exportDiag, "real XLSX buffer build started (browser path)");
          const raw = await buildBuffer();
          itemsExportDiagLog(exportDiag, "real XLSX buffer build finished (browser path)", {
            byteLength: raw instanceof ArrayBuffer ? raw.byteLength : (raw as Uint8Array).byteLength,
          });
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime, exportDiag);
        } catch (err) {
          console.error("Export failed", err);
          itemsExportDiagLog(exportDiag, "catch/fallback entered (browser path)", { err: String(err) });
        }
        return;
      }

      itemsExportDiagLog(exportDiag, "native save path entered (Tauri)");
      try {
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        itemsExportDiagLog(exportDiag, "save() returned", { path: path ?? null });
        itemsExportDiagLog(exportDiag, "real XLSX buffer build started (Tauri path)");
        const raw = await buildBuffer();
        itemsExportDiagLog(exportDiag, "real XLSX buffer build finished (Tauri path)", {
          byteLength: raw instanceof ArrayBuffer ? raw.byteLength : (raw as Uint8Array).byteLength,
        });
        const buffer = coerceWriteBufferResult(raw);

        if (path == null) {
          itemsExportDiagLog(exportDiag, "save() null — browser download fallback");
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime, exportDiag);
          return;
        }

        itemsExportDiagLog(exportDiag, "native write path entered", { path });
        const safePath = await ensureUniqueExportPath(path);
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
        itemsExportDiagLog(exportDiag, "export success reached (Tauri write)", { filename });
      } catch (err) {
        console.error("Export failed", err);
        itemsExportDiagLog(exportDiag, "catch/fallback entered (Tauri path)", { err: String(err) });
        try {
          const raw = await buildBuffer();
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime, exportDiag);
        } catch (fallbackErr) {
          console.error("Export browser fallback failed", fallbackErr);
        }
      }
    },
    [t],
  );

  const listExcelLabels = useMemo(() => itemsListExcelLabels(t), [t, locale]);
  const handleExportCurrentView = useCallback(async () => {
    const exportDiag = searchParams.get("exportDiag") === "1";
    if (exportDiag) {
      itemsExportDiagLog(exportDiag, "export click entered", { exportDiag: true });
      itemsExportDiagLog(exportDiag, "Case A — simple direct blob download started (same click flow)");
      downloadBufferInBrowser(
        "items-export delivery probe\n",
        "items-export-probe.txt",
        "text/plain",
        exportDiag,
      );
      itemsExportDiagLog(exportDiag, "Case A — simple direct blob download helper returned");
    }

    const payload = buildExportPayload();
    itemsExportDiagLog(exportDiag, "real export payload built", {
      headerCount: payload.headers.length,
      rowCount: payload.rows.length,
    });

    // With zero visible columns, `addTable` receives `columns: []` and ExcelJS fails — previously a silent no-op in browser.
    if (payload.headers.length === 0) {
      itemsExportDiagLog(exportDiag, "zero visible columns — using placeholder XLSX (Case B substitute)");
      await runExportWithSaveAs(
        "items.xlsx",
        () =>
          buildListViewXlsxBuffer({
            sheetName: listExcelLabels.sheetName,
            headers: ["—"],
            rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
            tableNameBase: "ItemsListView",
          }),
        exportDiag,
      );
      return;
    }

    await runExportWithSaveAs(
      "items.xlsx",
      async () => {
        itemsExportDiagLog(exportDiag, "real XLSX buffer build started (payload path)");
        const buf = await buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase: "ItemsListView",
        });
        itemsExportDiagLog(exportDiag, "real XLSX buffer build finished (payload path)", {
          byteLength: buf instanceof ArrayBuffer ? buf.byteLength : (buf as Uint8Array).byteLength,
        });
        return buf;
      },
      exportDiag,
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs, searchParams]);

  const handleExportSelectedRows = useCallback(async () => {
    const selectedRows = displayItems.filter((row) => rowSelection[row.id] === true);
    if (selectedRows.length === 0) return;

    const exportDiag = searchParams.get("exportDiag") === "1";
    const payload = buildExportPayloadForRows(selectedRows);
    itemsExportDiagLog(exportDiag, "selected export payload built", {
      headerCount: payload.headers.length,
      selectedRowCount: selectedRows.length,
    });

    if (payload.headers.length === 0) {
      await runExportWithSaveAs(
        "items-selected.xlsx",
        () =>
          buildListViewXlsxBuffer({
            sheetName: listExcelLabels.sheetName,
            headers: ["—"],
            rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
            tableNameBase: "ItemsListViewSelected",
          }),
        exportDiag,
      );
      return;
    }

    await runExportWithSaveAs(
      "items-selected.xlsx",
      async () => {
        itemsExportDiagLog(exportDiag, "selected XLSX buffer build started");
        const buf = await buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase: "ItemsListViewSelected",
        });
        itemsExportDiagLog(exportDiag, "selected XLSX buffer build finished", {
          byteLength: buf instanceof ArrayBuffer ? buf.byteLength : (buf as Uint8Array).byteLength,
        });
        return buf;
      },
      exportDiag,
    );
  }, [buildExportPayloadForRows, displayItems, listExcelLabels, rowSelection, runExportWithSaveAs, searchParams]);

  const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>((updater) => {
    setRowSelection((prev) => functionalUpdate(updater, prev));
  }, []);

  const exportSelectedDisabled = useMemo(
    () => !Object.values(rowSelection).some(Boolean),
    [rowSelection],
  );

  const listContent = itemsReady ? (
    <>
      {markdownScanMatch ? (
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
          role="status"
        >
          <span className="text-foreground/90">
            {t("ops.list.items.markdownScanBanner", { code: markdownScanMatch.markdownCode })}
          </span>
          <Link
            className="list-table__link shrink-0 font-medium"
            to={`/markdown-journal?view=codes&q=${encodeURIComponent(markdownScanMatch.markdownCode)}`}
          >
            {t("common.open")}
          </Link>
        </div>
      ) : markdownCodeNoRecord ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          <span>
            {t("ops.list.items.markdownCodeNotFound", {
              code: searchQuery.trim().toUpperCase(),
            })}
          </span>
          <Link className="list-table__link shrink-0 font-medium text-foreground/90" to="/markdown-journal">
            {t("markdown.journal.title")}
          </Link>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ItemsTanstackTable
          rows={displayItems}
          schema={itemsTableSchema}
          sorting={tanstackSorting}
          columnVisibility={tableColumnVisibility}
          columnOrder={tableColumnOrder}
          columnSizing={columnSizing}
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
          onSortingChange={handleTanstackSortingChange}
          onColumnSizingChange={handleColumnSizingChange}
          onHeaderFilterClick={(fieldId, anchorRect) => setHeaderFilterAnchor({ fieldId, ...anchorRect })}
          headerFilterState={activeDeepFilterFieldState}
          openHeaderFilterFieldId={activeHeaderFilterField}
          onRowClick={(row) => {
            if (hasMeaningfulTextSelection()) return;
            navigate(appendReturnTo(`/items/${row.id}`, currentReturnTo));
          }}
          t={t}
          formatMoney={formatMoney}
          scrollContainerRef={gridContainerRef}
        />
        <ItemsHeaderFilterPanel
          open={headerFilterAnchor != null}
          anchorRect={headerFilterAnchor}
          field={activeHeaderFilterRegistryField}
          filterConfig={activeHeaderFilterConfig as ListViewColumnFilterConfig<unknown> | undefined}
          rule={activeHeaderFilterRule}
          onOpenChange={(open) => {
            if (!open) setHeaderFilterAnchor(null);
          }}
          onApply={handleHeaderFilterApply}
          onReset={handleHeaderFilterReset}
        />
      </div>

      <ListViewColumnSettingsModal
        open={columnSettingsOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openColumnSettings();
            return;
          }
          cancelColumnSettingsDraft();
        }}
        items={columnSettingsDraftItems}
        onItemsChange={(nextItems) => setColumnSettingsDraftItems(() => nextItems)}
        filterRules={columnSettingsDraftDeepFilters}
        onFilterRulesChange={(nextRules) => setColumnSettingsDraftDeepFilters(() => nextRules)}
        sortRules={columnSettingsDraftDeepSorts}
        onSortRulesChange={(nextRules) => setColumnSettingsDraftDeepSorts(() => nextRules)}
        registry={columnSettingsRegistry}
        filterConfigs={itemColumnFilterConfigs as Record<string, ListViewColumnFilterConfig<unknown>>}
        includeHiddenInFilterSort
        personalViews={columnSettingsPersonalViews}
        activeViewId={columnSettingsActiveViewId}
        activeViewName={columnSettingsActiveViewName}
        hasUnsavedChanges={columnSettingsHasUnsavedChanges}
        onActivateView={activateColumnSettingsPersonalView}
        onCreateView={createColumnSettingsPersonalViewFromCurrent}
        onSaveChangesToActiveView={saveColumnSettingsActivePersonalViewFromCurrent}
        onRenameActiveView={renameColumnSettingsActivePersonalView}
        onDeleteActiveView={deleteColumnSettingsActivePersonalView}
        onSetActiveAsDefault={setColumnSettingsActivePersonalViewAsDefault}
        onApply={handleApplyColumnSettings}
        onCancel={cancelColumnSettingsDraft}
        onReset={resetColumnSettingsDraftToDefaults}
      />
    </>
  ) : (
    <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
  );

  return (
    <ItemsModuleLayout
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      contentVariant="full"
      contentClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <ListPageLayout
      header={null}
      controls={
        <div className="flex w-full min-w-0 flex-col gap-2">
          <div className="list-page__controls-stack flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.list.items.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchQueryChange}
            debounceMs={220}
            aria-label={t("ops.list.items.searchAria")}
            resultCount={displayItems.length}
          />
          <div className="list-page__toolbar-actions-cluster flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
            {brandFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.list.filterBrandAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.list.filterBrand")}
                </span>
                <span className="min-w-0 truncate font-medium text-foreground/90" title={brandFilterLabel}>
                  {brandFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearBrandFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {categoryFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.list.filterCategoryAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.list.filterCategory")}
                </span>
                <span className="min-w-0 truncate font-medium text-foreground/90" title={categoryFilterLabel}>
                  {categoryFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearCategoryFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {exportSuccess && (
              <div className="flex h-8 w-max shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm">
                <span className="text-xs text-muted-foreground">{t("doc.list.exportCompleted")}</span>
                <span className="max-w-[12rem] truncate text-xs font-medium" title={exportSuccess.filename}>
                  {exportSuccess.filename}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title={t("doc.list.openFile")}
                  aria-label={t("doc.list.openFile")}
                  onClick={async () => {
                    try {
                      await invoke("open_export_file", { path: exportSuccess.path });
                      setExportSuccess(null);
                    } catch (err) {
                      console.error("Export failed", err);
                      setExportSuccess(null);
                    }
                  }}
                >
                  <File className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title={t("doc.list.openFolder")}
                  aria-label={t("doc.list.openFolder")}
                  onClick={() => {
                    revealItemInDir(exportSuccess.path);
                    setExportSuccess(null);
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
                  title={t("doc.list.dismiss")}
                  aria-label={t("doc.list.dismiss")}
                  onClick={() => setExportSuccess(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex shrink-0 items-stretch rounded-md border border-input">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!gap-0.5 h-[1.625rem] rounded-r-none border-0 border-r border-input !px-1 !py-0"
                onClick={async () => {
                  try {
                    await handleExportCurrentView();
                  } catch (err) {
                    console.error("[items-export] export failed", err);
                  }
                }}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                {t("doc.list.export")}
              </Button>
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[1.625rem] w-[1.625rem] shrink-0 rounded-l-none border-0 shadow-none"
                    aria-label={t("doc.list.exportOptionsAria")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="!w-max min-w-0 p-1.5" align="end" side="top">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={exportSelectedDisabled}
                      className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        exportSelectedDisabled
                          ? t("doc.list.selectRowsForExport")
                          : t("doc.list.exportSelectedRows")
                      }
                      onClick={async () => {
                        if (exportSelectedDisabled) return;
                        try {
                          await handleExportSelectedRows();
                        } catch (err) {
                          console.error("[items-export] selected export failed", err);
                        } finally {
                          setExportOpen(false);
                        }
                      }}
                    >
                      {t("doc.list.exportSelectedRows")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-icon="inline-start"
              className="h-[1.625rem] shrink-0 !gap-0.5"
              onClick={openColumnSettings}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              {t("doc.list.viewSettings")}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="list-page__create-btn shrink-0 rounded-md bg-white text-black hover:bg-gray-200"
              onClick={() => navigate(appendReturnTo("/items/new", currentReturnTo))}
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>{" "}
              {t("doc.list.create")}
            </Button>
          </div>
        </div>
        </div>
      }
    >
      {listContent}
    </ListPageLayout>
    </ItemsModuleLayout>
  );
}
