/**
 * Barcode Registry master list — TanStack Table renderer aligned with Items / Carriers list architecture.
 */
import {
  functionalUpdate,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, File, FileSpreadsheet, FolderOpen, SlidersHorizontal, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { ItemBarcodeSymbology } from "@/modules/items";
import { ItemsModuleLayout } from "@/modules/items/components/ItemsModuleLayout";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import {
  applyListViewColumnFilters,
  applyDeepSortModel,
  useListViewColumnSettings,
  ListViewColumnSettingsModal,
  hasMeaningfulTextSelection,
  getListViewEmptyStateContent,
  type ListViewColumnFilterConfig,
} from "@/shared/ui/list-view";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import { useTranslation } from "@/shared/i18n/context";
import { barcodeRegistryListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { readListViewUrlSort, serializeListViewUrlSort, type ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import {
  hasActiveListViewColumnFilters,
  readUrlListViewColumnFilters,
  withUrlListViewColumnFilters,
} from "@/shared/navigation/listViewColumnFilters";
import {
  buildListViewUrlSortFromDeepSortRules,
  pruneDeepSortRulesByHiddenFields,
  type ListViewDeepFilterRule,
} from "@/shared/ui/list-view/listViewConfig";
import { ItemsHeaderFilterPanel } from "@/modules/items/ItemsHeaderFilterPanel";
import { BarcodeRegistryTanstackTable } from "../BarcodeRegistryTanstackTable";
import { buildBarcodeRegistryListViewCatalog } from "../barcodeRegistryListViewFieldCatalog";
import {
  buildBarcodeRegistryTableSchema,
  type BarcodeRegistryTableColumnSchema,
} from "../barcodeRegistryTableSchema";
import { buildBarcodeRegistryTableListViewState } from "../barcodeRegistryListViewState";
import { formatBarcodeRegistryTableValue } from "../barcodeRegistryTanstackColumns";
import {
  listBarcodeRegistryRows,
  type BarcodeRegistryEntryType,
  type BarcodeRegistryRow,
  type BarcodeRegistrySource,
} from "../barcodeRegistryReadModel";

const COLUMN_SIZING_STORAGE_KEY = "mini-erp:barcode-registry:tanstack:columnSizing:v1";
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
  throw new Error(`[barcode-registry-export] unexpected workbook buffer type: ${Object.prototype.toString.call(data)}`);
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
  schema: BarcodeRegistryTableColumnSchema[],
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

function filterRows(rows: BarcodeRegistryRow[], searchQuery: string): BarcodeRegistryRow[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (q !== "" && !row.code.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function BarcodeRegistryPage() {
  const { t, locale } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const searchParamsSort = searchParams.get("sort") ?? "";
  const appRevision = useAppReadModelRevision();
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingSortModel, setPendingSortModel] = useState<ListViewUrlSort[] | null>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => readPersistedColumnSizing());
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

  const entryTypeLabel = useCallback(
    (value: BarcodeRegistryEntryType) =>
      value === "ITEM_BARCODE"
        ? t("ops.list.barcodeRegistry.entryTypeItemBarcode")
        : t("ops.list.barcodeRegistry.entryTypeMarkdownCode"),
    [t],
  );

  const sourceLabel = useCallback(
    (value: BarcodeRegistrySource) => {
      if (value === "MARKDOWN_JOURNAL") return t("ops.list.barcodeRegistry.sourceMarkdownJournal");
      return t(`master.item.barcodes.sources.${value}`);
    },
    [t],
  );

  const symbologyLabel = useCallback(
    (value?: ItemBarcodeSymbology) =>
      value ? t(`master.item.barcodes.types.${value}`) : t("domain.audit.summary.emDash"),
    [t],
  );

  const markdownStatusLabel = useCallback(
    (value?: string) => (value ? t(`markdown.status.${value}`) : t("domain.audit.summary.emDash")),
    [t],
  );

  const rows = useMemo(() => listBarcodeRegistryRows(), [appRevision]);

  const sourceEnumOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.source))];
    return values
      .sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b), locale))
      .map((value) => ({
        value,
        label: sourceLabel(value),
      }));
  }, [rows, sourceLabel, locale]);

  const symbologyEnumOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.symbology).filter(Boolean))].map((value) => ({
        value: String(value),
        label: symbologyLabel(value as ItemBarcodeSymbology),
      })),
    [rows, symbologyLabel],
  );

  const markdownStatusEnumOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.markdownStatus).filter(Boolean))].map((value) => ({
        value: String(value),
        label: markdownStatusLabel(String(value)),
      })),
    [rows, markdownStatusLabel],
  );

  const entryTypeEnumOptions = useMemo(
    () => [
      { value: "ITEM_BARCODE", label: entryTypeLabel("ITEM_BARCODE") },
      { value: "MARKDOWN_CODE", label: entryTypeLabel("MARKDOWN_CODE") },
    ],
    [entryTypeLabel],
  );

  const filteredRows = useMemo(() => filterRows(rows, searchQuery), [rows, searchQuery]);

  const barcodeTableSchema = useMemo(() => buildBarcodeRegistryTableSchema({ t }), [t, locale, appRevision]);

  useEffect(() => {
    setColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, barcodeTableSchema);
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
  }, [barcodeTableSchema]);

  const barcodeListViewCatalog = useMemo(
    () =>
      buildBarcodeRegistryListViewCatalog({
        t,
        entryTypeLabel,
        sourceLabel,
        symbologyLabel,
        markdownStatusLabel,
        entryTypeEnumOptions,
        sourceEnumOptions,
        symbologyEnumOptions,
        markdownStatusEnumOptions,
      }),
    [
      t,
      locale,
      appRevision,
      entryTypeLabel,
      sourceLabel,
      symbologyLabel,
      markdownStatusLabel,
      entryTypeEnumOptions,
      sourceEnumOptions,
      symbologyEnumOptions,
      markdownStatusEnumOptions,
    ],
  );

  const baseColumnDefs = barcodeListViewCatalog.columnDefs;
  const barcodeFieldRegistry = barcodeListViewCatalog.fieldRegistry;
  const barcodeColumnFilterConfigs = barcodeListViewCatalog.filterConfigs;

  const displayRowsWithQueryFilters = useMemo(
    () => applyListViewColumnFilters(filteredRows, columnFilterModel, barcodeColumnFilterConfigs),
    [filteredRows, columnFilterModel, barcodeColumnFilterConfigs],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive = hasActiveListViewColumnFilters(columnFilterModel);

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
  } = useListViewColumnSettings<BarcodeRegistryRow>({
    pageKey: "barcodes",
    entityType: "barcodes",
    baseColumnDefs,
    fieldRegistry: barcodeFieldRegistry,
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
    (row: BarcodeRegistryRow, fieldKey: string): unknown => {
      const config = barcodeColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [barcodeColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyListViewColumnFilters(displayRowsWithQueryFilters, deepFilterModel, barcodeColumnFilterConfigs),
    [displayRowsWithQueryFilters, deepFilterModel, barcodeColumnFilterConfigs],
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
      buildBarcodeRegistryTableListViewState({
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
        barcodeTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [barcodeTableSchema],
  );
  const fallbackColumnOrder = useMemo(
    () => barcodeTableSchema.map((column) => column.id),
    [barcodeTableSchema],
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
    activeHeaderFilterField != null ? barcodeColumnFilterConfigs[activeHeaderFilterField] : undefined;
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
        const next = sanitizeColumnSizing(functionalUpdate(updater, current), barcodeTableSchema);
        return next;
      });
    },
    [barcodeTableSchema],
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
    const schemaById = new Map(barcodeTableSchema.map((column) => [column.id, column]));
    return tableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is BarcodeRegistryTableColumnSchema => Boolean(column))
      .filter((column) => tableColumnVisibility[column.id] !== false);
  }, [barcodeTableSchema, tableColumnOrder, tableColumnVisibility]);

  const buildExportPayloadForRows = useCallback(
    (exportRows: BarcodeRegistryRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = exportRows.map((row, index) =>
        visibleSchemaColumns.map((column) =>
          formatBarcodeRegistryTableValue({
            column,
            value: column.id === "lineNo" ? index + 1 : row[column.accessorKey ?? "code"],
            t,
            rowIndex: index,
            entryTypeLabel,
            sourceLabel,
            symbologyLabel,
            markdownStatusLabel,
          }),
        ),
      );

      return {
        headers: visibleSchemaColumns.map((column) => column.label),
        rows: rowsOut,
      };
    },
    [visibleSchemaColumns, t, entryTypeLabel, sourceLabel, symbologyLabel, markdownStatusLabel],
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
        const raw = await buildBuffer();
        const buffer = coerceWriteBufferResult(raw);

        if (path == null) {
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime);
          return;
        }

        const safePath = await ensureUniqueExportPath(path);
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

  const listExcelLabels = useMemo(() => barcodeRegistryListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(async () => {
    const payload = buildExportPayload();

    if (payload.headers.length === 0) {
      await runExportWithSaveAs("barcode-registry.xlsx", () =>
        buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase: "BarcodeRegistryListView",
        }),
      );
      return;
    }

    await runExportWithSaveAs("barcode-registry.xlsx", async () => {
      const buf = await buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "BarcodeRegistryListView",
      });
      return buf;
    });
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelectedRows = useCallback(async () => {
    const selectedRows = displayRows.filter((row) => rowSelection[row.id] === true);
    if (selectedRows.length === 0) return;

    const payload = buildExportPayloadForRows(selectedRows);

    if (payload.headers.length === 0) {
      await runExportWithSaveAs("barcode-registry-selected.xlsx", () =>
        buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase: "BarcodeRegistryListViewSelected",
        }),
      );
      return;
    }

    await runExportWithSaveAs("barcode-registry-selected.xlsx", async () => {
      const buf = await buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "BarcodeRegistryListViewSelected",
      });
      return buf;
    });
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
      getListViewEmptyStateContent(
        {
          baseRowCount: rows.length,
          visibleRowCount: displayRows.length,
          searchActive,
          filtersActive,
        },
        t,
      ),
    [rows.length, displayRows.length, searchActive, filtersActive, t, locale],
  );

  const listContent = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <BarcodeRegistryTanstackTable
          rows={displayRows}
          schema={barcodeTableSchema}
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
            navigate(appendReturnTo(row.nativePath, currentReturnTo));
          }}
          t={t}
          entryTypeLabel={entryTypeLabel}
          sourceLabel={sourceLabel}
          symbologyLabel={symbologyLabel}
          markdownStatusLabel={markdownStatusLabel}
          scrollContainerRef={gridContainerRef}
          emptyState={noRowsOverlay}
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
        filterConfigs={barcodeColumnFilterConfigs as Record<string, ListViewColumnFilterConfig<unknown>>}
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
    <ItemsModuleLayout
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      contentVariant="full"
      contentClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.list.barcodeRegistry.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchQueryChange}
            debounceMs={220}
            aria-label={t("ops.list.barcodeRegistry.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="list-page__toolbar-actions-cluster flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
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
                    console.error("[barcode-registry-export] export failed", err);
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
                          console.error("[barcode-registry-export] selected export failed", err);
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
    </ItemsModuleLayout>
  );
}
