/**
 * Customers master list — TanStack Table renderer aligned with the Items list architecture.
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
import { customerRepository } from "../repository";
import { carrierRepository } from "../../carriers/repository";
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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, SlidersHorizontal, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { customersListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { readUrlGridSort, serializeUrlGridSort, type UrlGridSort } from "@/shared/navigation/agGridSort";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
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
import { buildCustomersListViewCatalog } from "../customersListViewFieldCatalog";
import { buildCustomerListRows, type CustomerListRow } from "../customerListRowModel";
import { buildCustomersTableSchema, type CustomersTableColumnSchema } from "../customersTableSchema";
import { buildCustomersTableListViewState } from "../customersListViewState";
import { formatCustomersTableValue } from "../customersTanstackColumns";
import { CustomersTanstackTable } from "../CustomersTanstackTable";
import { ItemsHeaderFilterPanel } from "@/modules/items/ItemsHeaderFilterPanel";

function parseQueryId(searchParams: URLSearchParams, key: string): string | null {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function filterByPreferredCarrierId(list: CustomerListRow[], carrierId: string | null): CustomerListRow[] {
  if (carrierId == null) return list;
  return list.filter((c) => (c.preferredCarrierId?.trim() ?? "") === carrierId);
}

const COLUMN_SIZING_STORAGE_KEY = "mini-erp:customers:tanstack:columnSizing:v1";
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
const PDF_MIME = "application/pdf";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function customersExportDiagLog(enabled: boolean, message: string, detail?: unknown) {
  if (!enabled) return;
  console.info("[customers-export]", message, detail ?? "");
}

function downloadBufferInBrowser(
  data: BlobPart,
  downloadFilename: string,
  mimeType: string,
  exportDiag = false,
) {
  customersExportDiagLog(exportDiag, "browser download helper entered", { downloadFilename, mimeType });
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
  customersExportDiagLog(exportDiag, "browser download helper completed", { downloadFilename });
}

function coerceWriteBufferResult(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as DataView | Uint8Array | Int8Array;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer;
  }
  throw new Error(`[customers-export] unexpected workbook buffer type: ${Object.prototype.toString.call(data)}`);
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
  schema: CustomersTableColumnSchema[],
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

export function CustomersListPage() {
  const { t, locale } = useTranslation();
  const { formatMoney } = useAppDisplayFormatters();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const searchParamsSort = searchParams.get("sort") ?? "";
  const preferredCarrierFilterId = useMemo(
    () => parseQueryId(searchParams, "preferredCarrierId"),
    [searchParams],
  );
  const appReadRevision = useAppReadModelRevision();
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

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      replaceQueryParam(searchParams, setSearchParams, "q", value);
    },
    [searchParams, setSearchParams],
  );

  const filteredCustomers = useMemo(() => {
    const searched = customerRepository.search(searchQuery);
    return filterByPreferredCarrierId(searched, preferredCarrierFilterId);
  }, [searchQuery, preferredCarrierFilterId, appReadRevision]);

  const listRows = useMemo(() => buildCustomerListRows(filteredCustomers), [filteredCustomers]);

  const customersListViewCatalog = useMemo(
    () =>
      buildCustomersListViewCatalog({
        t,
        formatMoney,
      }),
    [t, locale, formatMoney, appReadRevision],
  );
  const customersTableSchema = useMemo(() => buildCustomersTableSchema({ t }), [t, locale, appReadRevision]);

  useEffect(() => {
    setColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, customersTableSchema);
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
  }, [customersTableSchema]);

  const baseColumnDefs = customersListViewCatalog.columnDefs;
  const customerFieldRegistry = customersListViewCatalog.fieldRegistry;
  const customerColumnFilterConfigs = customersListViewCatalog.filterConfigs;

  const displayRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(listRows, columnFilterModel, customerColumnFilterConfigs),
    [listRows, columnFilterModel, customerColumnFilterConfigs],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive =
    preferredCarrierFilterId != null || hasActiveAgGridColumnFilters(columnFilterModel);

  const preferredCarrierFilterLabel = useMemo((): string => {
    if (preferredCarrierFilterId == null) return "";
    const c = carrierRepository.getById(preferredCarrierFilterId);
    if (c) return c.name || c.code || preferredCarrierFilterId;
    return preferredCarrierFilterId;
  }, [preferredCarrierFilterId]);

  const clearPreferredCarrierFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("preferredCarrierId");
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
  } = useAgGridColumnSettings<CustomerListRow>({
    pageKey: "customers",
    entityType: "customers",
    baseColumnDefs,
    fieldRegistry: customerFieldRegistry,
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
    (row: CustomerListRow, fieldKey: string): unknown => {
      const config = customerColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [customerColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayRowsWithQueryFilters, deepFilterModel, customerColumnFilterConfigs),
    [displayRowsWithQueryFilters, deepFilterModel, customerColumnFilterConfigs],
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
      buildCustomersTableListViewState({
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
        customersTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [customersTableSchema],
  );
  const fallbackColumnOrder = useMemo(
    () => customersTableSchema.map((column) => column.id),
    [customersTableSchema],
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
    activeHeaderFilterField != null ? customerColumnFilterConfigs[activeHeaderFilterField] : undefined;
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
        const next = sanitizeColumnSizing(functionalUpdate(updater, current), customersTableSchema);
        return next;
      });
    },
    [customersTableSchema],
  );

  const handleApplyColumnSettings = useCallback(() => {
    const { hiddenIds } = applyColumnSettingsDraft();
    const prunedDraftDeepSorts = pruneDeepSortRulesByHiddenFields(
      columnSettingsDraftDeepSorts,
      hiddenIds,
    );
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
    const schemaById = new Map(customersTableSchema.map((column) => [column.id, column]));
    return tableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is CustomersTableColumnSchema => Boolean(column))
      .filter((column) => tableColumnVisibility[column.id] !== false);
  }, [customersTableSchema, tableColumnOrder, tableColumnVisibility]);

  const buildExportPayloadForRows = useCallback(
    (rows: CustomerListRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = rows.map((row, index) =>
        visibleSchemaColumns.map((column) =>
          formatCustomersTableValue({
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
    (): { headers: string[]; rows: Array<Array<string | number>> } => buildExportPayloadForRows(displayRows),
    [buildExportPayloadForRows, displayRows],
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
      customersExportDiagLog(exportDiag, "runtime branch chosen", { isTauriRuntime: tauri });

      if (!tauri) {
        customersExportDiagLog(exportDiag, "native save path skipped (browser/dev)");
        try {
          customersExportDiagLog(exportDiag, "real XLSX buffer build started (browser path)");
          const raw = await buildBuffer();
          customersExportDiagLog(exportDiag, "real XLSX buffer build finished (browser path)", {
            byteLength: raw instanceof ArrayBuffer ? raw.byteLength : (raw as Uint8Array).byteLength,
          });
          const buffer = coerceWriteBufferResult(raw);
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime, exportDiag);
        } catch (err) {
          console.error("Export failed", err);
          customersExportDiagLog(exportDiag, "catch/fallback entered (browser path)", { err: String(err) });
        }
        return;
      }

      customersExportDiagLog(exportDiag, "native save path entered (Tauri)");
      try {
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        customersExportDiagLog(exportDiag, "save() returned", { path: path ?? null });
        customersExportDiagLog(exportDiag, "real XLSX buffer build started (Tauri path)");
        const raw = await buildBuffer();
        customersExportDiagLog(exportDiag, "real XLSX buffer build finished (Tauri path)", {
          byteLength: raw instanceof ArrayBuffer ? raw.byteLength : (raw as Uint8Array).byteLength,
        });
        const buffer = coerceWriteBufferResult(raw);

        if (path == null) {
          customersExportDiagLog(exportDiag, "save() null — browser download fallback");
          downloadBufferInBrowser(buffer, generatedFilename, fallbackMime, exportDiag);
          return;
        }

        customersExportDiagLog(exportDiag, "native write path entered", { path });
        const safePath = await ensureUniqueExportPath(path);
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
        customersExportDiagLog(exportDiag, "export success reached (Tauri write)", { filename });
      } catch (err) {
        console.error("Export failed", err);
        customersExportDiagLog(exportDiag, "catch/fallback entered (Tauri path)", { err: String(err) });
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

  const listExcelLabels = useMemo(() => customersListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(async () => {
    const exportDiag = searchParams.get("exportDiag") === "1";
    if (exportDiag) {
      customersExportDiagLog(exportDiag, "export click entered", { exportDiag: true });
      downloadBufferInBrowser(
        "customers-export delivery probe\n",
        "customers-export-probe.txt",
        "text/plain",
        exportDiag,
      );
    }

    const payload = buildExportPayload();
    customersExportDiagLog(exportDiag, "real export payload built", {
      headerCount: payload.headers.length,
      rowCount: payload.rows.length,
    });

    if (payload.headers.length === 0) {
      customersExportDiagLog(exportDiag, "zero visible columns — placeholder XLSX");
      await runExportWithSaveAs(
        "customers.xlsx",
        () =>
          buildListViewXlsxBuffer({
            sheetName: listExcelLabels.sheetName,
            headers: ["—"],
            rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
            tableNameBase: "CustomersListView",
          }),
        exportDiag,
      );
      return;
    }

    await runExportWithSaveAs(
      "customers.xlsx",
      async () => {
        const buf = await buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase: "CustomersListView",
        });
        return buf;
      },
      exportDiag,
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs, searchParams]);

  const handleExportSelectedRows = useCallback(async () => {
    const selectedRows = displayRows.filter((row) => rowSelection[row.id] === true);
    if (selectedRows.length === 0) return;

    const exportDiag = searchParams.get("exportDiag") === "1";
    const payload = buildExportPayloadForRows(selectedRows);
    customersExportDiagLog(exportDiag, "selected export payload built", {
      headerCount: payload.headers.length,
      selectedRowCount: selectedRows.length,
    });

    if (payload.headers.length === 0) {
      await runExportWithSaveAs(
        "customers-selected.xlsx",
        () =>
          buildListViewXlsxBuffer({
            sheetName: listExcelLabels.sheetName,
            headers: ["—"],
            rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
            tableNameBase: "CustomersListViewSelected",
          }),
        exportDiag,
      );
      return;
    }

    await runExportWithSaveAs(
      "customers-selected.xlsx",
      async () => {
        const buf = await buildListViewXlsxBuffer({
          sheetName: listExcelLabels.sheetName,
          headers: payload.headers,
          rows: payload.rows,
          tableNameBase: "CustomersListViewSelected",
        });
        return buf;
      },
      exportDiag,
    );
  }, [buildExportPayloadForRows, displayRows, listExcelLabels, rowSelection, runExportWithSaveAs, searchParams]);

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
          baseRowCount: customerRepository.list().length,
          visibleRowCount: displayRows.length,
          searchActive,
          filtersActive,
        },
        t,
      ),
    [displayRows.length, searchActive, filtersActive, t, locale],
  );

  const listContent = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CustomersTanstackTable
          rows={displayRows}
          schema={customersTableSchema}
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
            navigate(appendReturnTo(`/customers/${row.id}`, currentReturnTo));
          }}
          t={t}
          formatMoney={formatMoney}
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
        filterConfigs={customerColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
            placeholder={t("ops.list.customers.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchQueryChange}
            debounceMs={220}
            aria-label={t("ops.list.customers.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="list-page__toolbar-actions-cluster flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
            {preferredCarrierFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs"
                role="status"
                aria-label={t("ops.list.customers.filterPreferredCarrierAria")}
              >
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {t("ops.list.customers.preferredCarrierChipLabel")}
                </span>
                <span
                  className="min-w-0 truncate font-medium text-foreground/90"
                  title={preferredCarrierFilterLabel}
                >
                  {preferredCarrierFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearPreferredCarrierFilter}
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
                    console.error("[customers-export] export failed", err);
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
                          console.error("[customers-export] selected export failed", err);
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
              onClick={() => navigate(appendReturnTo("/customers/new", currentReturnTo))}
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
      }
    >
      {listContent}
    </ListPageLayout>
  );
}
