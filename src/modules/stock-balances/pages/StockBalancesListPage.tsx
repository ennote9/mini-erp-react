/**
 * Stock Balances list — TanStack Table (Items / Shipments list architecture).
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
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { itemRepository } from "../../items/repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import {
  applyAgGridColumnFilters,
  applyDeepSortModel,
  useAgGridColumnSettings,
  AgGridColumnSettingsModal,
  hasMeaningfulTextSelection,
  getAgGridNoRowsOverlayContent,
  type AgGridColumnFilterConfig,
} from "../../../shared/ui/ag-grid";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, SlidersHorizontal, X } from "lucide-react";
import {
  type StockBalanceCoverageStatus,
} from "../../../shared/stockBalancesOperationalMetrics";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { stockBalancesListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useSettings } from "../../../shared/settings/SettingsContext";
import { getEffectiveWorkspaceFeatureEnabled } from "../../../shared/workspace";
import { normalizeTrim } from "../../../shared/validation";
import type { StockStyle } from "@/shared/inventoryStyle";
import { readUrlGridSort, serializeUrlGridSort, type UrlGridSort } from "@/shared/navigation/agGridSort";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  withUrlAgGridColumnFilters,
} from "@/shared/navigation/agGridColumnFilters";
import {
  buildUrlGridSortFromDeepSortRules,
  pruneDeepSortRulesByHiddenFields,
  type ListViewDeepFilterRule,
} from "@/shared/ui/ag-grid/listViewConfig";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { buildStockBalancesListViewCatalog } from "../stockBalancesListViewFieldCatalog";
import { buildStockBalanceListRows, type StockBalanceListRow } from "../stockBalanceListRowModel";
import { buildStockBalancesTableSchema, type StockBalancesTableColumnSchema } from "../stockBalancesTableSchema";
import { buildStockBalancesTableListViewState } from "../stockBalancesListViewState";
import { formatStockBalancesTableValue } from "../stockBalancesTanstackColumns";
import { StockBalancesTanstackTable } from "../StockBalancesTanstackTable";
import { ItemsHeaderFilterPanel } from "@/modules/items/ItemsHeaderFilterPanel";

const COLUMN_SIZING_STORAGE_KEY = "mini-erp:stock-balances:tanstack:columnSizing:v1";
const MAX_REASONABLE_COLUMN_SIZE = 1200;

type HeaderFilterAnchor = {
  fieldId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type PendingHeaderFilterCommit =
  | { type: "apply"; rule: ListViewDeepFilterRule }
  | { type: "reset"; fieldKey: string };

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function downloadBufferInBrowser(data: BlobPart, downloadFilename: string, mimeType: string) {
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
}

function coerceWriteBufferResult(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as DataView | Uint8Array | Int8Array;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer;
  }
  throw new Error(`unexpected workbook buffer type: ${Object.prototype.toString.call(data)}`);
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
    // ignore
  }
}

function sanitizeColumnSizing(
  value: ColumnSizingState,
  schema: StockBalancesTableColumnSchema[],
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

function filterBySearch(
  rows: StockBalanceListRow[],
  query: string,
  coverageLabel: (s: StockBalanceCoverageStatus) => string,
  styleLabel: (s: StockStyle) => string,
): StockBalanceListRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q) ||
      styleLabel(r.style).toLowerCase().includes(q) ||
      coverageLabel(r.coverageStatus).toLowerCase().includes(q),
  );
}

function filterByWarehouseId(rows: StockBalanceListRow[], warehouseId: string | null): StockBalanceListRow[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByItemId(rows: StockBalanceListRow[], itemId: string | null): StockBalanceListRow[] {
  if (itemId == null) return rows;
  return rows.filter((r) => r.itemId === itemId);
}

function filterByBrandId(rows: StockBalanceListRow[], brandId: string | null): StockBalanceListRow[] {
  if (brandId == null) return rows;
  const want = normalizeTrim(brandId);
  return rows.filter((r) => {
    const it = itemRepository.getById(r.itemId);
    return normalizeTrim(it?.brandId ?? "") === want;
  });
}

function filterByCategoryId(rows: StockBalanceListRow[], categoryId: string | null): StockBalanceListRow[] {
  if (categoryId == null) return rows;
  const want = normalizeTrim(categoryId);
  return rows.filter((r) => {
    const it = itemRepository.getById(r.itemId);
    return normalizeTrim(it?.categoryId ?? "") === want;
  });
}

export function StockBalancesListPage() {
  const { t, locale } = useTranslation();
  const { formatNumber } = useAppDisplayFormatters();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const appReadRevision = useAppReadModelRevision();

  const coverageLabel = useCallback(
    (s: StockBalanceCoverageStatus) => t(`ops.stock.coverage.${s}`),
    [t],
  );
  const styleLabel = useCallback((s: StockStyle) => t(`ops.stock.styles.${s}`), [t]);

  const workspaceMode = settings.general.workspaceMode;
  const profileOverrides = settings.general.profileOverrides;
  const showOperationalGrid = getEffectiveWorkspaceFeatureEnabled(
    workspaceMode,
    profileOverrides,
    "stockBalancesOperationalGrid",
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const itemFilterId = useMemo(() => {
    const raw = searchParams.get("itemId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);
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
  const warehouseFilterId = useMemo(() => {
    const raw = searchParams.get("warehouseId");
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  }, [searchParams]);

  const searchQuery = searchParams.get("q") ?? "";
  const searchParamsSort = searchParams.get("sort") ?? "";

  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingSortModel, setPendingSortModel] = useState<UrlGridSort[] | null>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => readPersistedColumnSizing());
  const [headerFilterAnchor, setHeaderFilterAnchor] = useState<HeaderFilterAnchor | null>(null);
  const [pendingHeaderFilterCommit, setPendingHeaderFilterCommit] = useState<PendingHeaderFilterCommit | null>(null);
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState(() =>
    serializeUrlGridSort(readUrlGridSort(new URLSearchParams(location.search))),
  );

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  useEffect(() => {
    writePersistedColumnSizing(columnSizing);
  }, [columnSizing]);

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
    () => readUrlAgGridColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );

  const setQueryValue = useCallback(
    (key: string, value: string, defaultValue = "") => {
      replaceQueryParam(searchParams, setSearchParams, key, value, defaultValue);
    },
    [searchParams, setSearchParams],
  );

  const stockBalancesTableSchema = useMemo(
    () => buildStockBalancesTableSchema({ t, showOperationalGrid }),
    [t, locale, showOperationalGrid, appReadRevision],
  );

  useEffect(() => {
    setColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, stockBalancesTableSchema);
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
  }, [stockBalancesTableSchema]);

  const listRows = useMemo(() => buildStockBalanceListRows(), [appReadRevision]);

  const rowsAfterBrand = useMemo(
    () => filterByBrandId(listRows, brandFilterId),
    [listRows, brandFilterId],
  );
  const rowsAfterCategory = useMemo(
    () => filterByCategoryId(rowsAfterBrand, categoryFilterId),
    [rowsAfterBrand, categoryFilterId],
  );
  const rowsAfterItem = useMemo(
    () => filterByItemId(rowsAfterCategory, itemFilterId),
    [rowsAfterCategory, itemFilterId],
  );
  const rowsAfterWarehouse = useMemo(
    () => filterByWarehouseId(rowsAfterItem, warehouseFilterId),
    [rowsAfterItem, warehouseFilterId],
  );

  const filteredRows = useMemo(
    () => filterBySearch(rowsAfterWarehouse, searchQuery, coverageLabel, styleLabel),
    [rowsAfterWarehouse, searchQuery, coverageLabel, styleLabel],
  );

  const warehouseNameEnumOptions = useMemo(
    () =>
      Array.from(new Set(listRows.map((row) => row.warehouseName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [listRows],
  );

  const coverageEnumOptions = useMemo(
    () =>
      (["covered", "at_risk", "short"] as const).map((value) => ({
        value,
        label: coverageLabel(value),
      })),
    [coverageLabel],
  );

  const stockBalancesListViewCatalog = useMemo(
    () =>
      buildStockBalancesListViewCatalog({
        t,
        showOperationalGrid,
        styleLabel,
        coverageLabel,
        warehouseNameEnumOptions,
        coverageEnumOptions,
      }),
    [t, locale, showOperationalGrid, styleLabel, coverageLabel, warehouseNameEnumOptions, coverageEnumOptions],
  );

  const baseColumnDefs = stockBalancesListViewCatalog.columnDefs;
  const stockBalancesFieldRegistry = stockBalancesListViewCatalog.fieldRegistry;
  const stockBalanceColumnFilterConfigs = stockBalancesListViewCatalog.filterConfigs;

  const displayRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, stockBalanceColumnFilterConfigs),
    [filteredRows, columnFilterModel, stockBalanceColumnFilterConfigs],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive =
    warehouseFilterId != null ||
    itemFilterId != null ||
    brandFilterId != null ||
    categoryFilterId != null ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const brandFilterLabel = useMemo((): string => {
    if (brandFilterId == null) return "";
    const b = brandRepository.getById(brandFilterId);
    if (b) {
      const name = b.name?.trim() ? b.name : "";
      return name ? `${b.code} — ${b.name}` : b.code;
    }
    return brandFilterId;
  }, [brandFilterId]);

  const categoryFilterLabel = useMemo((): string => {
    if (categoryFilterId == null) return "";
    const c = categoryRepository.getById(categoryFilterId);
    if (c) {
      const name = c.name?.trim() ? c.name : "";
      return name ? `${c.code} — ${c.name}` : c.code;
    }
    return categoryFilterId;
  }, [categoryFilterId]);

  const itemFilterLabel = useMemo((): string => {
    if (itemFilterId == null) return "";
    const it = itemRepository.getById(itemFilterId);
    if (it) {
      const name = it.name?.trim() ? it.name : "";
      return name ? `${it.code} — ${it.name}` : it.code;
    }
    return itemFilterId;
  }, [itemFilterId]);

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const clearWarehouseFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("warehouseId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearItemFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
  } = useAgGridColumnSettings<StockBalanceListRow>({
    pageKey: "stock-balances",
    entityType: "stock-balances",
    baseColumnDefs,
    fieldRegistry: stockBalancesFieldRegistry,
    allowHiddenFilterSort: true,
  });

  const effectiveSortModel = useMemo(() => {
    if (pendingSortModel) return pendingSortModel;
    const urlSort = readUrlGridSort(new URLSearchParams(searchParamsSort ? `sort=${searchParamsSort}` : ""));
    const runtimeSort =
      runtimeSortSerialized === ""
        ? []
        : readUrlGridSort(new URLSearchParams(`sort=${runtimeSortSerialized}`));
    if (runtimeSort.length > 0 && runtimeSortSerialized !== searchParamsSort) return runtimeSort;
    if (urlSort.length > 0) return urlSort;
    if (runtimeSort.length > 0) return runtimeSort;
    return deepSortModel;
  }, [pendingSortModel, searchParamsSort, runtimeSortSerialized, deepSortModel]);

  const resolveDeepSortValue = useCallback(
    (row: StockBalanceListRow, fieldKey: string): unknown => {
      const config = stockBalanceColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [stockBalanceColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayRowsWithQueryFilters, deepFilterModel, stockBalanceColumnFilterConfigs),
    [displayRowsWithQueryFilters, deepFilterModel, stockBalanceColumnFilterConfigs],
  );

  const displayRows = useMemo(
    () =>
      applyDeepSortModel({
        rows: displayRowsWithDeepFilters,
        sortModel: effectiveSortModel,
        getFieldValue: resolveDeepSortValue,
      }),
    [displayRowsWithDeepFilters, effectiveSortModel, resolveDeepSortValue],
  );

  useEffect(() => {
    if (deepSortModel.length === 0) return;
    const nextSerialized = serializeUrlGridSort(deepSortModel);
    if (nextSerialized === searchParamsSort) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", nextSerialized);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSerialized);
  }, [deepSortModel, searchParams, searchParamsSort, setSearchParams]);

  useEffect(() => {
    if (!pendingSortModel) return;
    const pendingSerialized = serializeUrlGridSort(pendingSortModel);
    if (pendingSerialized === searchParamsSort) {
      setPendingSortModel(null);
    }
  }, [pendingSortModel, searchParamsSort]);

  const neutralListViewState = useMemo(
    () =>
      buildStockBalancesTableListViewState({
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
        stockBalancesTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [stockBalancesTableSchema],
  );
  const fallbackColumnOrder = useMemo(
    () => stockBalancesTableSchema.map((column) => column.id),
    [stockBalancesTableSchema],
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
  const activeDeepFilterFieldState = useMemo(() => {
    const activeFieldMap: Record<string, boolean> = {};
    for (const rule of columnSettingsDefinition?.deepFilters ?? []) {
      if (rule.enabled !== true) continue;
      activeFieldMap[rule.fieldKey] = true;
    }
    return activeFieldMap;
  }, [columnSettingsDefinition]);
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
    activeHeaderFilterField != null ? stockBalanceColumnFilterConfigs[activeHeaderFilterField] : undefined;
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
      })) as UrlGridSort[];
      const nextValue = serializeUrlGridSort(nextSortModel);
      setPendingSortModel(nextSortModel);
      setRuntimeSortSerialized(nextValue);
      replaceQueryParam(searchParams, setSearchParams, "sort", nextValue);
    },
    [tanstackSorting, searchParams, setSearchParams],
  );

  const handleColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((current) => {
        const next = sanitizeColumnSizing(functionalUpdate(updater, current), stockBalancesTableSchema);
        return next;
      });
    },
    [stockBalancesTableSchema],
  );

  const handleApplyColumnSettings = useCallback(() => {
    const { hiddenIds } = applyColumnSettingsDraft();
    const prunedDraftDeepSorts = pruneDeepSortRulesByHiddenFields(columnSettingsDraftDeepSorts, hiddenIds);
    const nextDeepSortModel = buildUrlGridSortFromDeepSortRules(prunedDraftDeepSorts);
    const nextDeepSortSerialized = serializeUrlGridSort(nextDeepSortModel);
    const currentDeepSortSerialized = serializeUrlGridSort(deepSortModel);
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
      nextParams = withUrlAgGridColumnFilters(nextParams, nextColumnFilterModel);
    }

    const nextSortSerialized = serializeUrlGridSort(nextSortModel);
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
    const schemaById = new Map(stockBalancesTableSchema.map((column) => [column.id, column]));
    return tableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is StockBalancesTableColumnSchema => Boolean(column))
      .filter((column) => tableColumnVisibility[column.id] !== false);
  }, [stockBalancesTableSchema, tableColumnOrder, tableColumnVisibility]);

  const buildExportPayloadForRows = useCallback(
    (rows: StockBalanceListRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = rows.map((row, index) =>
        visibleSchemaColumns.map((column) =>
          formatStockBalancesTableValue({
            column,
            value:
              column.id === "lineNo"
                ? index + 1
                : row[(column.accessorKey ?? column.id) as keyof StockBalanceListRow],
            t,
            formatNumber,
            styleLabel,
            coverageLabel,
            rowIndex: index,
          }),
        ),
      );

      return {
        headers: visibleSchemaColumns.map((column) => column.label),
        rows: rowsOut,
      };
    },
    [visibleSchemaColumns, t, formatNumber, styleLabel, coverageLabel],
  );

  const buildExportPayload = useCallback(
    (): { headers: string[]; rows: Array<Array<string | number>> } => buildExportPayloadForRows(displayRows),
    [buildExportPayloadForRows, displayRows],
  );

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer | Uint8Array>) => {
      const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
      const base = defaultFilename.replace(/\.[^.]+$/, "");
      const generatedFilename = buildReadableUniqueFilename({ base, extension });
      const fallbackMime = extension === "pdf" ? "application/pdf" : XLSX_MIME;
      const tauri = isTauriRuntime();

      if (!tauri) {
        try {
          const raw = await buildBuffer();
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime);
        } catch (err) {
          console.error("Export failed", err);
        }
        return;
      }

      try {
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) {
          const raw = await buildBuffer();
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime);
          return;
        }

        const safePath = await ensureUniqueExportPath(path);
        const raw = await buildBuffer();
        const buffer = coerceWriteBufferResult(raw);
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
      } catch (err) {
        console.error("Export failed", err);
        try {
          const raw = await buildBuffer();
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime);
        } catch (fallbackErr) {
          console.error("Export browser fallback failed", fallbackErr);
        }
      }
    },
    [t],
  );

  const listExcelLabels = useMemo(() => stockBalancesListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(async () => {
    const payload = buildExportPayload();
    if (payload.headers.length === 0) {
      await runExportWithSaveAs("stock-balances.xlsx", () =>
        buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase: "StockBalancesListView",
        }),
      );
      return;
    }
    await runExportWithSaveAs("stock-balances.xlsx", async () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "StockBalancesListView",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelectedRows = useCallback(async () => {
    const selectedRows = displayRows.filter((row) => rowSelection[row.id] === true);
    if (selectedRows.length === 0) return;

    const payload = buildExportPayloadForRows(selectedRows);
    if (payload.headers.length === 0) {
      await runExportWithSaveAs("stock-balances-selected.xlsx", () =>
        buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase: "StockBalancesListViewSelected",
        }),
      );
      return;
    }
    await runExportWithSaveAs("stock-balances-selected.xlsx", async () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "StockBalancesListViewSelected",
      }),
    );
  }, [buildExportPayloadForRows, displayRows, listExcelLabels, rowSelection, runExportWithSaveAs]);

  const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>((updater) => {
    setRowSelection((prev) => functionalUpdate(updater, prev));
  }, []);

  const exportSelectedDisabled = useMemo(
    () => !Object.values(rowSelection).some(Boolean),
    [rowSelection],
  );

  const noRowsOverlay = useMemo(
    () =>
      getAgGridNoRowsOverlayContent(
        {
          baseRowCount: listRows.length,
          visibleRowCount: displayRows.length,
          searchActive,
          filtersActive,
        },
        t,
      ),
    [listRows.length, displayRows.length, searchActive, filtersActive, t, locale],
  );

  const listContent = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <StockBalancesTanstackTable
          rows={displayRows}
          schema={stockBalancesTableSchema}
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
            navigate(appendReturnTo(`/stock-balances/${row.id}`, currentReturnTo));
          }}
          t={t}
          formatNumber={formatNumber}
          styleLabel={styleLabel}
          coverageLabel={coverageLabel}
          scrollContainerRef={gridContainerRef}
          emptyState={noRowsOverlay}
        />
        <ItemsHeaderFilterPanel
          open={headerFilterAnchor != null}
          anchorRect={headerFilterAnchor}
          field={activeHeaderFilterRegistryField}
          filterConfig={activeHeaderFilterConfig as AgGridColumnFilterConfig<unknown> | undefined}
          rule={activeHeaderFilterRule}
          onOpenChange={(open) => {
            if (!open) setHeaderFilterAnchor(null);
          }}
          onApply={handleHeaderFilterApply}
          onReset={handleHeaderFilterReset}
        />
      </div>

      <AgGridColumnSettingsModal
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
        filterConfigs={stockBalanceColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.stockBalances.searchPlaceholder")}
            value={searchQuery}
            onChange={(value) => setQueryValue("q", value)}
            debounceMs={220}
            aria-label={t("ops.stockBalances.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="list-page__toolbar-actions-cluster flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
            {brandFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.stockBalances.brandFilterAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.stockBalances.brandFilterPrefix")}
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
                aria-label={t("ops.stockBalances.categoryFilterAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.stockBalances.categoryFilterPrefix")}
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
            {itemFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.stockBalances.itemFilterAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.stockBalances.itemFilterPrefix")}
                </span>
                <span className="min-w-0 truncate font-medium text-foreground/90" title={itemFilterLabel}>
                  {itemFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearItemFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.stockBalances.warehouseFilterAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">{t("doc.columns.warehouse")}</span>
                <span className="min-w-0 truncate font-medium text-foreground/90" title={warehouseFilterLabel}>
                  {warehouseFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearWarehouseFilter}
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
                    console.error("Export failed", err);
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
                          console.error("Export failed", err);
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
          </div>
        </div>
      }
    >
      {listContent}
    </ListPageLayout>
  );
}
