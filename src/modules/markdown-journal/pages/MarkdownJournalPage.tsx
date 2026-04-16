/**
 * Markdown Journal register — journals + markdown codes lists (TanStack, Items / Movements pattern).
 */
import { functionalUpdate, type ColumnSizingState, type OnChangeFn, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, File, FileSpreadsheet, FolderOpen, SlidersHorizontal, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import {
  ListViewColumnSettingsModal,
  applyListViewColumnFilters,
  applyDeepSortModel,
  getListViewEmptyStateContent,
  hasMeaningfulTextSelection,
  useListViewColumnSettings,
  type ListViewColumnFilterConfig,
} from "@/shared/ui/list-view";
import { useTranslation } from "@/shared/i18n/context";
import { useAppDisplayFormatters } from "@/shared/formatting";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { readListViewUrlSort, serializeListViewUrlSort, type ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
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
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { ItemsHeaderFilterPanel } from "@/modules/items/ItemsHeaderFilterPanel";
import { buildMarkdownCodesListViewCatalog, buildMarkdownJournalsListViewCatalog } from "../markdownJournalListViewFieldCatalog";
import { buildJournalRows, buildMarkdownCodeRows, type JournalRow, type MarkdownCodeRow } from "../markdownJournalListRowModel";
import { buildMarkdownJournalTableListViewState } from "../markdownJournalListViewState";
import {
  buildMarkdownCodesTableSchema,
  buildMarkdownJournalsTableSchema,
  type MarkdownJournalTanstackColumnSchema,
} from "../markdownJournalTableSchema";
import {
  buildMarkdownCodesTanstackColumns,
  buildMarkdownJournalsTanstackColumns,
  formatMarkdownCodeTableValue,
  formatMarkdownJournalTableValue,
} from "../markdownJournalTanstackColumns";
import { MarkdownJournalTanstackTable } from "../MarkdownJournalTanstackTable";
import { markdownJournalLineRepository } from "../journalLineRepository";

type MarkdownRegisterView = "journals" | "codes";

const JOURNAL_COLUMN_SIZING_STORAGE_KEY = "mini-erp:markdown-journal:journals:tanstack:columnSizing:v1";
const CODE_COLUMN_SIZING_STORAGE_KEY = "mini-erp:markdown-journal:codes:tanstack:columnSizing:v1";
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

function readPersistedColumnSizing(storageKey: string): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ColumnSizingState;
  } catch {
    return {};
  }
}

function writePersistedColumnSizing(storageKey: string, value: ColumnSizingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function sanitizeColumnSizing(
  value: ColumnSizingState,
  schema: MarkdownJournalTanstackColumnSchema[],
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

export function MarkdownJournalPage() {
  const { t, locale } = useTranslation();
  const { formatMoney } = useAppDisplayFormatters();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appRevision = useAppReadModelRevision();

  const viewFromQuery = searchParams.get("view");
  const [view, setView] = useState<MarkdownRegisterView>(
    viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals",
  );
  const isJournalView = view === "journals";

  const searchQuery = searchParams.get("q") ?? "";
  const searchParamsSort = searchParams.get("sort") ?? "";
  const prefillItemId = searchParams.get("itemId") ?? "";

  const [exportOpen, setExportOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingSortModel, setPendingSortModel] = useState<ListViewUrlSort[] | null>(null);
  const [journalColumnSizing, setJournalColumnSizing] = useState<ColumnSizingState>(() =>
    readPersistedColumnSizing(JOURNAL_COLUMN_SIZING_STORAGE_KEY),
  );
  const [codeColumnSizing, setCodeColumnSizing] = useState<ColumnSizingState>(() =>
    readPersistedColumnSizing(CODE_COLUMN_SIZING_STORAGE_KEY),
  );
  const [headerFilterAnchor, setHeaderFilterAnchor] = useState<HeaderFilterAnchor | null>(null);
  const [pendingHeaderFilterCommit, setPendingHeaderFilterCommit] = useState<PendingHeaderFilterCommit | null>(null);
  const headerFilterCommitViewRef = useRef<MarkdownRegisterView>(view);
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState(() =>
    serializeListViewUrlSort(readListViewUrlSort(new URLSearchParams(location.search))),
  );

  const listSearchInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const listStateKey = useMemo(
    () => buildNavigationStateKey(location.pathname, searchParams),
    [location.pathname, searchParams],
  );
  useSessionScrollRestore(listStateKey, gridContainerRef);

  const currentReturnTo = useMemo(
    () => buildReturnToValue(location.pathname, location.search),
    [location.pathname, location.search],
  );

  useEffect(() => {
    const nextView = viewFromQuery === "codes" || viewFromQuery === "lines" ? "codes" : "journals";
    setView(nextView);
  }, [viewFromQuery]);

  useEffect(() => {
    setRowSelection({});
  }, [view]);

  useEffect(() => {
    writePersistedColumnSizing(JOURNAL_COLUMN_SIZING_STORAGE_KEY, journalColumnSizing);
  }, [journalColumnSizing]);

  useEffect(() => {
    writePersistedColumnSizing(CODE_COLUMN_SIZING_STORAGE_KEY, codeColumnSizing);
  }, [codeColumnSizing]);

  const setQueryValue = useCallback(
    (key: string, value: string, defaultValue = "") => {
      replaceQueryParam(searchParams, setSearchParams, key, value, defaultValue);
    },
    [searchParams, setSearchParams],
  );

  const columnFilterModel = useMemo(
    () => readUrlListViewColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );

  const journalRows = useMemo(() => buildJournalRows(t), [appRevision, t]);
  const codeRows = useMemo(() => buildMarkdownCodeRows(t), [appRevision, t]);

  const journalsTableSchema = useMemo(() => buildMarkdownJournalsTableSchema({ t }), [t, locale]);
  const codesTableSchema = useMemo(() => buildMarkdownCodesTableSchema({ t }), [t, locale]);

  useEffect(() => {
    setJournalColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, journalsTableSchema);
      if (
        Object.keys(current).length === Object.keys(next).length &&
        Object.keys(current).every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [journalsTableSchema]);

  useEffect(() => {
    setCodeColumnSizing((current) => {
      const next = sanitizeColumnSizing(current, codesTableSchema);
      if (
        Object.keys(current).length === Object.keys(next).length &&
        Object.keys(current).every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [codesTableSchema]);

  const journalsListViewCatalog = useMemo(
    () => buildMarkdownJournalsListViewCatalog({ t, journalRows }),
    [t, journalRows],
  );
  const codesListViewCatalog = useMemo(() => buildMarkdownCodesListViewCatalog({ t, codeRows }), [t, codeRows]);

  const journalColumnFilterConfigs = journalsListViewCatalog.filterConfigs;
  const codeColumnFilterConfigs = codesListViewCatalog.filterConfigs;

  const {
    draftItems: journalDraftItems,
    draftDeepFilters: journalDraftDeepFilters,
    draftDeepSorts: journalDraftDeepSorts,
    settingsOpen: journalSettingsOpen,
    openSettings: openJournalSettings,
    setDraftItems: setJournalDraftItems,
    setDraftDeepFilters: setJournalDraftDeepFilters,
    setDraftDeepSorts: setJournalDraftDeepSorts,
    applyDraft: applyJournalDraft,
    resetDraftToDefaults: resetJournalDraftToDefaults,
    cancelDraft: cancelJournalDraft,
    deepFilterModel: journalDeepFilterModel,
    deepSortModel: journalDeepSortModel,
    definition: journalDefinition,
    registry: journalRegistry,
    personalViews: journalPersonalViews,
    activeViewId: journalActiveViewId,
    activeViewName: journalActiveViewName,
    hasUnsavedChanges: journalHasUnsavedChanges,
    activatePersonalView: activateJournalPersonalView,
    createPersonalViewFromCurrent: createJournalPersonalViewFromCurrent,
    saveActivePersonalViewFromCurrent: saveJournalActivePersonalViewFromCurrent,
    renameActivePersonalView: renameJournalActivePersonalView,
    deleteActivePersonalView: deleteJournalActivePersonalView,
    setActivePersonalViewAsDefault: setJournalActivePersonalViewAsDefault,
  } = useListViewColumnSettings<JournalRow>({
    pageKey: "markdown-journal:journals",
    entityType: "markdown-journal-journals",
    baseColumnDefs: journalsListViewCatalog.columnDefs,
    fieldRegistry: journalsListViewCatalog.fieldRegistry,
    allowHiddenFilterSort: true,
  });

  const {
    draftItems: codeDraftItems,
    draftDeepFilters: codeDraftDeepFilters,
    draftDeepSorts: codeDraftDeepSorts,
    settingsOpen: codeSettingsOpen,
    openSettings: openCodeSettings,
    setDraftItems: setCodeDraftItems,
    setDraftDeepFilters: setCodeDraftDeepFilters,
    setDraftDeepSorts: setCodeDraftDeepSorts,
    applyDraft: applyCodeDraft,
    resetDraftToDefaults: resetCodeDraftToDefaults,
    cancelDraft: cancelCodeDraft,
    deepFilterModel: codeDeepFilterModel,
    deepSortModel: codeDeepSortModel,
    definition: codeDefinition,
    registry: codeRegistry,
    personalViews: codePersonalViews,
    activeViewId: codeActiveViewId,
    activeViewName: codeActiveViewName,
    hasUnsavedChanges: codeHasUnsavedChanges,
    activatePersonalView: activateCodePersonalView,
    createPersonalViewFromCurrent: createCodePersonalViewFromCurrent,
    saveActivePersonalViewFromCurrent: saveCodeActivePersonalViewFromCurrent,
    renameActivePersonalView: renameCodeActivePersonalView,
    deleteActivePersonalView: deleteCodeActivePersonalView,
    setActivePersonalViewAsDefault: setCodeActivePersonalViewAsDefault,
  } = useListViewColumnSettings<MarkdownCodeRow>({
    pageKey: "markdown-journal:codes",
    entityType: "markdown-journal-codes",
    baseColumnDefs: codesListViewCatalog.columnDefs,
    fieldRegistry: codesListViewCatalog.fieldRegistry,
    allowHiddenFilterSort: true,
  });

  const activeDeepSortModel = isJournalView ? journalDeepSortModel : codeDeepSortModel;

  const effectiveSortModel = useMemo(() => {
    if (pendingSortModel) return pendingSortModel;
    const urlSort = readListViewUrlSort(new URLSearchParams(searchParamsSort ? `sort=${searchParamsSort}` : ""));
    const runtimeSort =
      runtimeSortSerialized === "" ? [] : readListViewUrlSort(new URLSearchParams(`sort=${runtimeSortSerialized}`));
    if (runtimeSort.length > 0 && runtimeSortSerialized !== searchParamsSort) return runtimeSort;
    if (urlSort.length > 0) return urlSort;
    if (runtimeSort.length > 0) return runtimeSort;
    return activeDeepSortModel;
  }, [pendingSortModel, searchParamsSort, runtimeSortSerialized, activeDeepSortModel]);

  useEffect(() => {
    if (!pendingSortModel) return;
    const pendingSerialized = serializeListViewUrlSort(pendingSortModel);
    if (pendingSerialized === searchParamsSort) {
      setPendingSortModel(null);
    }
  }, [pendingSortModel, searchParamsSort]);

  const filteredJournalRows = useMemo(() => {
    let base = journalRows;
    if (prefillItemId) {
      const allowed = new Set(
        markdownJournalLineRepository.list().filter((line) => line.itemId === prefillItemId).map((line) => line.journalId),
      );
      base = base.filter((row) => allowed.has(row.id));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((row) => {
        if (row.number.toLowerCase().includes(q)) return true;
        if (row.sourceWarehouseLabel.toLowerCase().includes(q)) return true;
        if (row.targetWarehouseLabel.toLowerCase().includes(q)) return true;
        if (row.comment.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return base;
  }, [journalRows, prefillItemId, searchQuery, appRevision]);

  const filteredCodeRows = useMemo(() => {
    let base = codeRows;
    if (prefillItemId) {
      base = base.filter((row) => row.itemId === prefillItemId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((row) => {
        if (row.journalNumber.toLowerCase().includes(q)) return true;
        if (row.markdownCode.toLowerCase().includes(q)) return true;
        if (row.itemCode.toLowerCase().includes(q)) return true;
        if (row.itemName.toLowerCase().includes(q)) return true;
        if (row.warehouseLabel.toLowerCase().includes(q)) return true;
        if (row.statusLabel.toLowerCase().includes(q)) return true;
        if (row.reasonLabel.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return base;
  }, [codeRows, prefillItemId, searchQuery]);

  const displayJournalRowsWithQueryFilters = useMemo(
    () => applyListViewColumnFilters(filteredJournalRows, columnFilterModel, journalColumnFilterConfigs),
    [filteredJournalRows, columnFilterModel, journalColumnFilterConfigs],
  );

  const displayCodeRowsWithQueryFilters = useMemo(
    () => applyListViewColumnFilters(filteredCodeRows, columnFilterModel, codeColumnFilterConfigs),
    [filteredCodeRows, columnFilterModel, codeColumnFilterConfigs],
  );

  const resolveJournalSortValue = useCallback(
    (row: JournalRow, fieldKey: string): unknown => {
      const config = journalColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [journalColumnFilterConfigs],
  );

  const resolveCodeSortValue = useCallback(
    (row: MarkdownCodeRow, fieldKey: string): unknown => {
      const config = codeColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [codeColumnFilterConfigs],
  );

  const displayJournalRows = useMemo(
    () =>
      applyDeepSortModel({
        rows: applyListViewColumnFilters(
          displayJournalRowsWithQueryFilters,
          journalDeepFilterModel,
          journalColumnFilterConfigs,
        ),
        sortModel: effectiveSortModel,
        getFieldValue: resolveJournalSortValue,
      }),
    [
      displayJournalRowsWithQueryFilters,
      journalDeepFilterModel,
      journalColumnFilterConfigs,
      effectiveSortModel,
      resolveJournalSortValue,
    ],
  );

  const displayCodeRows = useMemo(
    () =>
      applyDeepSortModel({
        rows: applyListViewColumnFilters(
          displayCodeRowsWithQueryFilters,
          codeDeepFilterModel,
          codeColumnFilterConfigs,
        ),
        sortModel: effectiveSortModel,
        getFieldValue: resolveCodeSortValue,
      }),
    [
      displayCodeRowsWithQueryFilters,
      codeDeepFilterModel,
      codeColumnFilterConfigs,
      effectiveSortModel,
      resolveCodeSortValue,
    ],
  );

  const neutralJournalListViewState = useMemo(
    () =>
      buildMarkdownJournalTableListViewState({
        definition: journalDefinition,
        columnFilterModel,
        sortModel: effectiveSortModel,
        personalViews: journalPersonalViews,
        activeViewId: journalActiveViewId,
      }),
    [journalDefinition, columnFilterModel, effectiveSortModel, journalPersonalViews, journalActiveViewId],
  );

  const neutralCodeListViewState = useMemo(
    () =>
      buildMarkdownJournalTableListViewState({
        definition: codeDefinition,
        columnFilterModel,
        sortModel: effectiveSortModel,
        personalViews: codePersonalViews,
        activeViewId: codeActiveViewId,
      }),
    [codeDefinition, columnFilterModel, effectiveSortModel, codePersonalViews, codeActiveViewId],
  );

  const fallbackJournalColumnVisibility = useMemo<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        journalsTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [journalsTableSchema],
  );
  const fallbackJournalColumnOrder = useMemo(() => journalsTableSchema.map((column) => column.id), [journalsTableSchema]);

  const fallbackCodeColumnVisibility = useMemo<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        codesTableSchema.map((column) => [column.id, column.lockedVisible ? true : column.defaultVisible]),
      ),
    [codesTableSchema],
  );
  const fallbackCodeColumnOrder = useMemo(() => codesTableSchema.map((column) => column.id), [codesTableSchema]);

  const journalTableColumnVisibility = useMemo(() => {
    const visibility = neutralJournalListViewState.columnVisibility;
    return Object.keys(visibility).length > 0 ? visibility : fallbackJournalColumnVisibility;
  }, [neutralJournalListViewState.columnVisibility, fallbackJournalColumnVisibility]);

  const journalTableColumnOrder = useMemo(
    () =>
      neutralJournalListViewState.columnOrder.length > 0 ? neutralJournalListViewState.columnOrder : fallbackJournalColumnOrder,
    [neutralJournalListViewState.columnOrder, fallbackJournalColumnOrder],
  );

  const codeTableColumnVisibility = useMemo(() => {
    const visibility = neutralCodeListViewState.columnVisibility;
    return Object.keys(visibility).length > 0 ? visibility : fallbackCodeColumnVisibility;
  }, [neutralCodeListViewState.columnVisibility, fallbackCodeColumnVisibility]);

  const codeTableColumnOrder = useMemo(
    () => (neutralCodeListViewState.columnOrder.length > 0 ? neutralCodeListViewState.columnOrder : fallbackCodeColumnOrder),
    [neutralCodeListViewState.columnOrder, fallbackCodeColumnOrder],
  );

  const journalTanstackSorting = useMemo<SortingState>(
    () => neutralJournalListViewState.sorting.map((entry) => ({ id: entry.id, desc: entry.direction === "desc" })),
    [neutralJournalListViewState.sorting],
  );

  const codeTanstackSorting = useMemo<SortingState>(
    () => neutralCodeListViewState.sorting.map((entry) => ({ id: entry.id, desc: entry.direction === "desc" })),
    [neutralCodeListViewState.sorting],
  );

  const handleJournalColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>((updater) => {
    setJournalColumnSizing((current) => sanitizeColumnSizing(functionalUpdate(updater, current), journalsTableSchema));
  }, [journalsTableSchema]);

  const handleCodeColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>((updater) => {
    setCodeColumnSizing((current) => sanitizeColumnSizing(functionalUpdate(updater, current), codesTableSchema));
  }, [codesTableSchema]);

  const handleTanstackSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const base = isJournalView ? journalTanstackSorting : codeTanstackSorting;
      const nextSorting = functionalUpdate(updater, base);
      const nextSortModel = nextSorting.map((entry) => ({
        colId: entry.id,
        sort: entry.desc ? ("desc" as const) : ("asc" as const),
      })) as ListViewUrlSort[];
      const nextValue = serializeListViewUrlSort(nextSortModel);
      setPendingSortModel(nextSortModel);
      setRuntimeSortSerialized(nextValue);
      replaceQueryParam(searchParams, setSearchParams, "sort", nextValue);
    },
    [isJournalView, journalTanstackSorting, codeTanstackSorting, searchParams, setSearchParams],
  );

  const registryByFieldKey = useMemo(() => {
    const reg = isJournalView ? journalRegistry : codeRegistry;
    return new Map(reg.map((entry) => [entry.fieldKey, entry]));
  }, [isJournalView, journalRegistry, codeRegistry]);

  const activeDefinition = isJournalView ? journalDefinition : codeDefinition;
  const activeDeepFilterFieldState = useMemo(() => {
    const activeFieldMap: Record<string, boolean> = {};
    for (const rule of activeDefinition?.deepFilters ?? []) {
      if (rule.enabled !== true) continue;
      activeFieldMap[rule.fieldKey] = true;
    }
    return activeFieldMap;
  }, [activeDefinition]);

  const appliedRuleByFieldKey = useMemo(() => {
    const map = new Map<string, ListViewDeepFilterRule>();
    for (const rule of activeDefinition?.deepFilters ?? []) {
      if (!map.has(rule.fieldKey)) map.set(rule.fieldKey, rule);
    }
    return map;
  }, [activeDefinition]);

  const activeHeaderFilterField = headerFilterAnchor?.fieldId ?? null;
  const activeHeaderFilterRegistryField = activeHeaderFilterField
    ? registryByFieldKey.get(activeHeaderFilterField) ?? null
    : null;
  const activeHeaderFilterConfig =
    activeHeaderFilterField != null
      ? (isJournalView ? journalColumnFilterConfigs[activeHeaderFilterField] : codeColumnFilterConfigs[activeHeaderFilterField])
      : undefined;
  const activeHeaderFilterRule =
    activeHeaderFilterField != null ? appliedRuleByFieldKey.get(activeHeaderFilterField) ?? null : null;

  const journalDataColumns = useMemo(
    () => buildMarkdownJournalsTanstackColumns({ schema: journalsTableSchema, t }),
    [journalsTableSchema, t],
  );

  const codeDataColumns = useMemo(
    () => buildMarkdownCodesTanstackColumns({ schema: codesTableSchema, t, formatMoney }),
    [codesTableSchema, t, formatMoney],
  );

  const buildApplyColumnSettingsHandler = useCallback(
    (params: {
      applyDraft: () => { hiddenIds: string[] };
      draftDeepSorts: typeof journalDraftDeepSorts;
      deepSortModel: ListViewUrlSort[];
      effectiveSort: ListViewUrlSort[];
    }) => {
      const { hiddenIds } = params.applyDraft();
      const prunedDraftDeepSorts = pruneDeepSortRulesByHiddenFields(params.draftDeepSorts, hiddenIds);
      const nextDeepSortModel = buildListViewUrlSortFromDeepSortRules(prunedDraftDeepSorts);
      const nextDeepSortSerialized = serializeListViewUrlSort(nextDeepSortModel);
      const currentDeepSortSerialized = serializeListViewUrlSort(params.deepSortModel);
      const currentRuntimeSortSerialized = searchParamsSort;
      const deepSortsChanged = nextDeepSortSerialized !== currentDeepSortSerialized;
      const shouldSyncToDeepSort =
        nextDeepSortModel.length > 0 && currentRuntimeSortSerialized !== nextDeepSortSerialized;
      const runtimeUsesDeepSort =
        (currentRuntimeSortSerialized === "" && params.deepSortModel.length > 0) ||
        currentRuntimeSortSerialized === currentDeepSortSerialized;

      let nextSortModel = params.effectiveSort;
      if (deepSortsChanged || shouldSyncToDeepSort) {
        if (nextDeepSortModel.length > 0) {
          nextSortModel = nextDeepSortModel;
        } else if (runtimeUsesDeepSort) {
          nextSortModel = [];
        }
      } else if (hiddenIds.length > 0) {
        nextSortModel = params.effectiveSort.filter((entry) => !hiddenIds.includes(entry.colId));
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
    },
    [columnFilterModel, searchParams, searchParamsSort, setSearchParams],
  );

  const handleApplyJournalColumnSettings = useCallback(() => {
    buildApplyColumnSettingsHandler({
      applyDraft: applyJournalDraft,
      draftDeepSorts: journalDraftDeepSorts,
      deepSortModel: journalDeepSortModel,
      effectiveSort: effectiveSortModel,
    });
  }, [buildApplyColumnSettingsHandler, applyJournalDraft, journalDraftDeepSorts, journalDeepSortModel, effectiveSortModel]);

  const handleApplyCodeColumnSettings = useCallback(() => {
    buildApplyColumnSettingsHandler({
      applyDraft: applyCodeDraft,
      draftDeepSorts: codeDraftDeepSorts,
      deepSortModel: codeDeepSortModel,
      effectiveSort: effectiveSortModel,
    });
  }, [buildApplyColumnSettingsHandler, applyCodeDraft, codeDraftDeepSorts, codeDeepSortModel, effectiveSortModel]);

  const handleHeaderFilterApply = useCallback(
    (nextRule: ListViewDeepFilterRule) => {
      headerFilterCommitViewRef.current = isJournalView ? "journals" : "codes";
      if (isJournalView) {
        setJournalDraftDeepFilters((prev) => {
          const others = prev.filter((rule) => rule.fieldKey !== nextRule.fieldKey);
          return [...others, { ...nextRule, priority: others.length }];
        });
      } else {
        setCodeDraftDeepFilters((prev) => {
          const others = prev.filter((rule) => rule.fieldKey !== nextRule.fieldKey);
          return [...others, { ...nextRule, priority: others.length }];
        });
      }
      setHeaderFilterAnchor(null);
      setPendingHeaderFilterCommit({ type: "apply", rule: nextRule });
    },
    [isJournalView, setJournalDraftDeepFilters, setCodeDraftDeepFilters],
  );

  const handleHeaderFilterReset = useCallback(() => {
    if (!activeHeaderFilterField) return;
    headerFilterCommitViewRef.current = isJournalView ? "journals" : "codes";
    if (isJournalView) {
      setJournalDraftDeepFilters((prev) => prev.filter((rule) => rule.fieldKey !== activeHeaderFilterField));
    } else {
      setCodeDraftDeepFilters((prev) => prev.filter((rule) => rule.fieldKey !== activeHeaderFilterField));
    }
    setHeaderFilterAnchor(null);
    setPendingHeaderFilterCommit({ type: "reset", fieldKey: activeHeaderFilterField });
  }, [
    activeHeaderFilterField,
    isJournalView,
    setJournalDraftDeepFilters,
    setCodeDraftDeepFilters,
  ]);

  useEffect(() => {
    if (!pendingHeaderFilterCommit) return;
    if (headerFilterCommitViewRef.current === "journals") {
      handleApplyJournalColumnSettings();
    } else {
      handleApplyCodeColumnSettings();
    }
    setPendingHeaderFilterCommit(null);
  }, [pendingHeaderFilterCommit, handleApplyJournalColumnSettings, handleApplyCodeColumnSettings]);

  const visibleJournalSchemaColumns = useMemo(() => {
    const schemaById = new Map(journalsTableSchema.map((column) => [column.id, column]));
    return journalTableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is MarkdownJournalTanstackColumnSchema => Boolean(column))
      .filter((column) => journalTableColumnVisibility[column.id] !== false);
  }, [journalsTableSchema, journalTableColumnOrder, journalTableColumnVisibility]);

  const visibleCodeSchemaColumns = useMemo(() => {
    const schemaById = new Map(codesTableSchema.map((column) => [column.id, column]));
    return codeTableColumnOrder
      .map((id) => schemaById.get(id))
      .filter((column): column is MarkdownJournalTanstackColumnSchema => Boolean(column))
      .filter((column) => codeTableColumnVisibility[column.id] !== false);
  }, [codesTableSchema, codeTableColumnOrder, codeTableColumnVisibility]);

  const buildExportPayloadForJournalRows = useCallback(
    (rows: JournalRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = rows.map((row, index) =>
        visibleJournalSchemaColumns.map((column) =>
          formatMarkdownJournalTableValue({
            column,
            value:
              column.id === "lineNo"
                ? index + 1
                : row[(column.accessorKey ?? column.id) as keyof JournalRow],
            t,
            rowIndex: index,
          }),
        ),
      );
      return {
        headers: visibleJournalSchemaColumns.map((column) => column.label),
        rows: rowsOut,
      };
    },
    [visibleJournalSchemaColumns, t],
  );

  const buildExportPayloadForCodeRows = useCallback(
    (rows: MarkdownCodeRow[]): { headers: string[]; rows: Array<Array<string | number>> } => {
      const rowsOut = rows.map((row, index) =>
        visibleCodeSchemaColumns.map((column) =>
          formatMarkdownCodeTableValue({
            column,
            value:
              column.id === "lineNo"
                ? index + 1
                : row[(column.accessorKey ?? column.id) as keyof MarkdownCodeRow],
            t,
            formatMoney,
            rowIndex: index,
          }),
        ),
      );
      return {
        headers: visibleCodeSchemaColumns.map((column) => column.label),
        rows: rowsOut,
      };
    },
    [visibleCodeSchemaColumns, t, formatMoney],
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
          filters: [{ name: t("ops.importModal.excelFileFilterName"), extensions: ["xlsx"] }],
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

  const handleExportCurrentView = useCallback(async () => {
    const payload = isJournalView
      ? buildExportPayloadForJournalRows(displayJournalRows)
      : buildExportPayloadForCodeRows(displayCodeRows);
    const sheetName = isJournalView ? t("markdown.journal.journalsTab") : t("markdown.journal.markdownCodesTab");
    const tableNameBase = isJournalView ? "MarkdownJournalsListView" : "MarkdownCodesListView";
    const defaultFilename = isJournalView ? "markdown-journals.xlsx" : "markdown-codes.xlsx";

    if (payload.headers.length === 0) {
      await runExportWithSaveAs(defaultFilename, () =>
        buildListViewXlsxBuffer({
          sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase,
        }),
      );
      return;
    }
    await runExportWithSaveAs(defaultFilename, async () =>
      buildListViewXlsxBuffer({
        sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase,
      }),
    );
  }, [
    isJournalView,
    buildExportPayloadForJournalRows,
    buildExportPayloadForCodeRows,
    displayJournalRows,
    displayCodeRows,
    runExportWithSaveAs,
    t,
  ]);

  const handleExportSelectedRows = useCallback(async () => {
    const selectedJournal = displayJournalRows.filter((row) => rowSelection[row.id] === true);
    const selectedCode = displayCodeRows.filter((row) => rowSelection[row.id] === true);
    const payload = isJournalView
      ? buildExportPayloadForJournalRows(selectedJournal)
      : buildExportPayloadForCodeRows(selectedCode);
    if (payload.rows.length === 0) return;

    const sheetName = isJournalView ? t("markdown.journal.journalsTab") : t("markdown.journal.markdownCodesTab");
    const tableNameBase = isJournalView ? "MarkdownJournalsListViewSelected" : "MarkdownCodesListViewSelected";
    const defaultFilename = isJournalView ? "markdown-journals-selected.xlsx" : "markdown-codes-selected.xlsx";

    if (payload.headers.length === 0) {
      await runExportWithSaveAs(defaultFilename, () =>
        buildListViewXlsxBuffer({
          sheetName,
          headers: ["—"],
          rows: [["No visible columns. Use View settings to show at least one column, then export again."]],
          tableNameBase,
        }),
      );
      return;
    }
    await runExportWithSaveAs(defaultFilename, async () =>
      buildListViewXlsxBuffer({
        sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase,
      }),
    );
  }, [
    isJournalView,
    buildExportPayloadForJournalRows,
    buildExportPayloadForCodeRows,
    displayJournalRows,
    displayCodeRows,
    rowSelection,
    runExportWithSaveAs,
    t,
  ]);

  const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>((updater) => {
    setRowSelection((prev) => functionalUpdate(updater, prev));
  }, []);

  const exportSelectedDisabled = useMemo(
    () => !Object.values(rowSelection).some(Boolean),
    [rowSelection],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive = prefillItemId !== "" || hasActiveListViewColumnFilters(columnFilterModel);
  const baseRowsCount = isJournalView ? journalRows.length : codeRows.length;
  const activeRows = isJournalView ? displayJournalRows : displayCodeRows;

  const noRowsOverlay = useMemo(
    () =>
      getListViewEmptyStateContent(
        {
          baseRowCount: baseRowsCount,
          visibleRowCount: activeRows.length,
          searchActive,
          filtersActive,
        },
        t,
      ),
    [baseRowsCount, activeRows.length, searchActive, filtersActive, t, locale],
  );

  const createTarget = useMemo(() => {
    if (!prefillItemId) return "/markdown-journal/new";
    return `/markdown-journal/new?itemId=${encodeURIComponent(prefillItemId)}`;
  }, [prefillItemId]);

  const handleRowNavigate = useCallback(
    (row: JournalRow | MarkdownCodeRow) => {
      if (hasMeaningfulTextSelection()) return;
      if (isJournalView) {
        navigate(appendReturnTo(`/markdown-journal/journals/${row.id}`, currentReturnTo));
      } else {
        navigate(appendReturnTo(`/markdown-journal/journals/${(row as MarkdownCodeRow).journalId}`, currentReturnTo));
      }
    },
    [isJournalView, navigate, currentReturnTo],
  );

  const listContent = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isJournalView ? (
          <MarkdownJournalTanstackTable<JournalRow>
            rows={displayJournalRows}
            schema={journalsTableSchema}
            dataColumns={journalDataColumns}
            selectRowAriaCode={(row) => row.number}
            sorting={journalTanstackSorting}
            columnVisibility={journalTableColumnVisibility}
            columnOrder={journalTableColumnOrder}
            columnSizing={journalColumnSizing}
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
            onSortingChange={handleTanstackSortingChange}
            onColumnSizingChange={handleJournalColumnSizingChange}
            onHeaderFilterClick={(fieldId, anchorRect) => setHeaderFilterAnchor({ fieldId, ...anchorRect })}
            headerFilterState={activeDeepFilterFieldState}
            openHeaderFilterFieldId={activeHeaderFilterField}
            t={t}
            scrollContainerRef={gridContainerRef}
            emptyState={noRowsOverlay}
            onRowClick={handleRowNavigate}
          />
        ) : (
          <MarkdownJournalTanstackTable<MarkdownCodeRow>
            rows={displayCodeRows}
            schema={codesTableSchema}
            dataColumns={codeDataColumns}
            selectRowAriaCode={(row) => row.markdownCode}
            sorting={codeTanstackSorting}
            columnVisibility={codeTableColumnVisibility}
            columnOrder={codeTableColumnOrder}
            columnSizing={codeColumnSizing}
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
            onSortingChange={handleTanstackSortingChange}
            onColumnSizingChange={handleCodeColumnSizingChange}
            onHeaderFilterClick={(fieldId, anchorRect) => setHeaderFilterAnchor({ fieldId, ...anchorRect })}
            headerFilterState={activeDeepFilterFieldState}
            openHeaderFilterFieldId={activeHeaderFilterField}
            t={t}
            scrollContainerRef={gridContainerRef}
            emptyState={noRowsOverlay}
            onRowClick={handleRowNavigate}
          />
        )}
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

      {isJournalView ? (
        <ListViewColumnSettingsModal
          open={journalSettingsOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              openJournalSettings();
              return;
            }
            cancelJournalDraft();
          }}
          items={journalDraftItems}
          onItemsChange={(nextItems) => setJournalDraftItems(() => nextItems)}
          filterRules={journalDraftDeepFilters}
          onFilterRulesChange={(nextRules) => setJournalDraftDeepFilters(() => nextRules)}
          sortRules={journalDraftDeepSorts}
          onSortRulesChange={(nextRules) => setJournalDraftDeepSorts(() => nextRules)}
          registry={journalRegistry}
          filterConfigs={journalColumnFilterConfigs as Record<string, ListViewColumnFilterConfig<unknown>>}
          includeHiddenInFilterSort
          personalViews={journalPersonalViews}
          activeViewId={journalActiveViewId}
          activeViewName={journalActiveViewName}
          hasUnsavedChanges={journalHasUnsavedChanges}
          onActivateView={activateJournalPersonalView}
          onCreateView={createJournalPersonalViewFromCurrent}
          onSaveChangesToActiveView={saveJournalActivePersonalViewFromCurrent}
          onRenameActiveView={renameJournalActivePersonalView}
          onDeleteActiveView={deleteJournalActivePersonalView}
          onSetActiveAsDefault={setJournalActivePersonalViewAsDefault}
          onApply={handleApplyJournalColumnSettings}
          onCancel={cancelJournalDraft}
          onReset={resetJournalDraftToDefaults}
        />
      ) : (
        <ListViewColumnSettingsModal
          open={codeSettingsOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              openCodeSettings();
              return;
            }
            cancelCodeDraft();
          }}
          items={codeDraftItems}
          onItemsChange={(nextItems) => setCodeDraftItems(() => nextItems)}
          filterRules={codeDraftDeepFilters}
          onFilterRulesChange={(nextRules) => setCodeDraftDeepFilters(() => nextRules)}
          sortRules={codeDraftDeepSorts}
          onSortRulesChange={(nextRules) => setCodeDraftDeepSorts(() => nextRules)}
          registry={codeRegistry}
          filterConfigs={codeColumnFilterConfigs as Record<string, ListViewColumnFilterConfig<unknown>>}
          includeHiddenInFilterSort
          personalViews={codePersonalViews}
          activeViewId={codeActiveViewId}
          activeViewName={codeActiveViewName}
          hasUnsavedChanges={codeHasUnsavedChanges}
          onActivateView={activateCodePersonalView}
          onCreateView={createCodePersonalViewFromCurrent}
          onSaveChangesToActiveView={saveCodeActivePersonalViewFromCurrent}
          onRenameActiveView={renameCodeActivePersonalView}
          onDeleteActiveView={deleteCodeActivePersonalView}
          onSetActiveAsDefault={setCodeActivePersonalViewAsDefault}
          onApply={handleApplyCodeColumnSettings}
          onCancel={cancelCodeDraft}
          onReset={resetCodeDraftToDefaults}
        />
      )}
    </>
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ButtonGroup className="list-page__filter-group" aria-label={t("markdown.journal.title")}>
              {(["journals", "codes"] as const).map((value, index) => (
                <div key={value} className="contents">
                  {index > 0 && <ButtonGroupSeparator />}
                  <Button
                    type="button"
                    variant={view === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      if (value === "journals") next.delete("view");
                      else next.set("view", value);
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    {value === "journals"
                      ? t("markdown.journal.journalsTab")
                      : t("markdown.journal.markdownCodesTab")}
                  </Button>
                </div>
              ))}
            </ButtonGroup>
            <ListPageSearch
              inputRef={listSearchInputRef}
              placeholder={
                view === "journals"
                  ? t("markdown.journal.searchJournals")
                  : t("markdown.journal.searchMarkdownCodes")
              }
              value={searchQuery}
              onChange={(value) => setQueryValue("q", value)}
              debounceMs={220}
              aria-label={
                view === "journals"
                  ? t("markdown.journal.searchJournals")
                  : t("markdown.journal.searchMarkdownCodes")
              }
              resultCount={activeRows.length}
            />
            {exportSuccess && (
              <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
                <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>
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
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-stretch rounded-md border border-input shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-[1.625rem] rounded-r-none border-0 border-r border-input !px-1 !py-0 !gap-0.5"
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
                        title={exportSelectedDisabled ? t("doc.list.selectRowsForExport") : undefined}
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
                onClick={() => {
                  if (isJournalView) openJournalSettings();
                  else openCodeSettings();
                }}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
                {t("doc.list.viewSettings")}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="list-page__create-btn rounded-md bg-white text-black hover:bg-gray-200"
                onClick={() => navigate(appendReturnTo(createTarget, currentReturnTo))}
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
                {t("markdown.actions.create")}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {listContent}
    </ListPageLayout>
  );
}
