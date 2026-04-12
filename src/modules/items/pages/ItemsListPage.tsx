/**
 * Items list — AG Grid migration. Uses shared AgGridContainer and defaultColDef.
 * Preserves search, New button, row navigation, empty state.
 */
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { itemRepository } from "../repository";
import { brandRepository } from "../../brands/repository";
import { categoryRepository } from "../../categories/repository";
import type { Item } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import {
  AgGridContainer,
  AgGridActiveBooleanCellRenderer,
  applyAgGridColumnFilters,
  applyDeepSortModel,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
  agGridSelectionColumnDef,
  decorateAgGridColumnDefsWithFilters,
  useAgGridColumnFilterBridge,
  useAgGridNoRowsOverlayLifecycle,
  useAgGridColumnSettings,
  AgGridColumnSettingsModal,
  getVisibleAgGridExportColumns,
  collectFilteredSortedRowNodes,
  buildExportMatrixFromRowNodes,
  hasMeaningfulTextSelection,
  getAgGridNoRowsOverlayContent,
  buildAgGridNoRowsOverlayTemplate,
  type AgGridColumnFilterConfig,
} from "../../../shared/ui/ag-grid";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
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
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  withUrlAgGridColumnFilters,
} from "@/shared/navigation/agGridColumnFilters";

function applyBrandIdFilter(items: Item[], brandId: string | null): Item[] {
  if (brandId == null || brandId === "") return items;
  return items.filter((x) => x.brandId === brandId);
}

function applyCategoryIdFilter(items: Item[], categoryId: string | null): Item[] {
  if (categoryId == null || categoryId === "") return items;
  return items.filter((x) => x.categoryId === categoryId);
}

/** Image count only — no thumbnails (Items list). */
function ImagesCountCellRenderer(params: ICellRendererParams<Item, number>) {
  const n = typeof params.value === "number" ? params.value : 0;
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }
  return <span className="tabular-nums text-foreground/90">{n}</span>;
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
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const categoryFilterId = useMemo(() => {
    const raw = searchParams.get("categoryId");
    if (raw == null || raw === "") return null;
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const searchQuery = searchParams.get("q") ?? "";
  const appReadRevision = useAppReadModelRevision();
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<Item> | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
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
  const initialSortModel = useMemo(
    () => readUrlGridSort(new URLSearchParams(location.search)),
    [location.search],
  );
  const columnFilterModel = useMemo(
    () => readUrlAgGridColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState(() => serializeUrlGridSort(initialSortModel));

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<Item>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      replaceQueryParam(searchParams, setSearchParams, "q", value);
    },
    [searchParams, setSearchParams],
  );

  const syncSortToUrl = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const nextSortModel = getCurrentGridSort(api, ["selection", "lineNo"]);
    const nextValue = serializeUrlGridSort(nextSortModel);
    setRuntimeSortSerialized(nextValue);
    replaceQueryParam(searchParams, setSearchParams, "sort", nextValue);
  }, [searchParams, setSearchParams]);

  const filteredItems = useMemo(() => {
    const searched = itemRepository.search(searchQuery);
    const brandFiltered = applyBrandIdFilter(searched, brandFilterId);
    return applyCategoryIdFilter(brandFiltered, categoryFilterId);
  }, [searchQuery, brandFilterId, categoryFilterId, appReadRevision]);

  const itemColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<Item>>>(
    () => ({
      code: { kind: "text" },
      itemKind: {
        kind: "enum",
        getValue: (item) => item.itemKind ?? "SELLABLE",
        options: [
          { value: "SELLABLE", label: t("master.item.kind.sellable") },
          { value: "TESTER", label: t("master.item.kind.tester") },
        ],
      },
      name: { kind: "text" },
      imageCount: {
        kind: "number",
        getValue: (item) => (Array.isArray(item.images) ? item.images.length : 0),
      },
      brand: {
        kind: "enum",
        getValue: (item) => {
          if (!item.brandId) return "";
          return brandRepository.getById(item.brandId)?.name ?? "";
        },
        options: brandRepository
          .list()
          .map((brand) => ({ value: brand.name, label: brand.name })),
      },
      category: {
        kind: "enum",
        getValue: (item) => {
          if (!item.categoryId) return "";
          return categoryRepository.getById(item.categoryId)?.name ?? "";
        },
        options: categoryRepository
          .list()
          .map((category) => ({ value: category.name, label: category.name })),
      },
      uom: { kind: "text" },
      purchasePrice: { kind: "number" },
      salePrice: { kind: "number" },
      isActive: { kind: "boolean" },
    }),
    [t, locale, appReadRevision],
  );

  const displayItemsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredItems, columnFilterModel, itemColumnFilterConfigs),
    [filteredItems, columnFilterModel, itemColumnFilterConfigs],
  );

  const markdownScanMatch = useMemo(() => {
    const q = searchQuery.trim();
    if (!isMarkdownCodeFormat(q)) return null;
    return resolveMarkdownRecordByScanInput(q);
  }, [searchQuery, appReadRevision]);

  /** MD-shaped code with no matching markdown record — avoids silent confusion with empty item search. */
  const markdownCodeNoRecord = useMemo(() => {
    const q = searchQuery.trim();
    if (!isMarkdownCodeFormat(q)) return false;
    return resolveMarkdownRecordByScanInput(q) == null;
  }, [searchQuery, appReadRevision]);

  const searchActive = searchQuery.trim() !== "";
  const filtersActive =
    brandFilterId != null ||
    categoryFilterId != null ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const brandFilterLabel = useMemo((): string => {
    if (brandFilterId == null) return "";
    const b = brandRepository.getById(brandFilterId);
    if (b) return b.name || b.code || brandFilterId;
    return brandFilterId;
  }, [brandFilterId]);

  const clearBrandFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("brandId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const categoryFilterLabel = useMemo((): string => {
    if (categoryFilterId == null) return "";
    const c = categoryRepository.getById(categoryFilterId);
    if (c) return c.name || c.code || categoryFilterId;
    return categoryFilterId;
  }, [categoryFilterId]);

  const clearCategoryFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoryId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const buildExportPayload = useCallback(
    (mode: "current" | "selected"): { headers: string[]; rows: Array<Array<string | number>> } => {
      const api = gridRef.current?.api;
      if (!api) return { headers: [], rows: [] };
      const columns = getVisibleAgGridExportColumns(api, { entityType: "items" });
      const rowNodes =
        mode === "selected"
          ? api.getSelectedNodes()
          : collectFilteredSortedRowNodes(api);
      return {
        headers: columns.map((x) => x.headerName),
        rows: buildExportMatrixFromRowNodes(api, columns, rowNodes),
      };
    },
    [],
  );

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const extension = defaultFilename.toLowerCase().endsWith(".pdf") ? "pdf" : "xlsx";
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension });
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) return;
        const safePath = await ensureUniqueExportPath(path);

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path: safePath, contentsBase64 });
        const filename = safePath.replace(/^.*[/\\]/, "") || generatedFilename;
        setExportSuccess({ path: safePath, filename });
      } catch (err) {
        console.error("Export failed", err);
        const buffer = await buildBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [t],
  );

  const listExcelLabels = useMemo(() => itemsListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const payload = buildExportPayload("current");
    runExportWithSaveAs("items.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "ItemsListView",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const payload = buildExportPayload("selected");
    if (payload.rows.length === 0) return;
    runExportWithSaveAs("items-selected.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "ItemsListViewSelected",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const baseColumnDefs = useMemo<ColDef<Item>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "code",
        headerName: t("doc.columns.code"),
        width: 130,
      },
      {
        colId: "itemKind",
        headerName: t("master.item.list.kindColumn"),
        width: 100,
        maxWidth: 120,
        valueGetter: (params) => params.data?.itemKind ?? "SELLABLE",
        valueFormatter: (params) =>
          params.value === "TESTER" ? t("master.item.kind.tester") : t("master.item.kind.sellable"),
      },
      {
        field: "name",
        headerName: t("doc.columns.name"),
        minWidth: 160,
        flex: 1,
      },
      {
        colId: "imageCount",
        headerName: t("doc.columns.images"),
        width: 76,
        maxWidth: 88,
        valueGetter: (params) =>
          Array.isArray(params.data?.images) ? params.data!.images.length : 0,
        cellRenderer: ImagesCountCellRenderer,
      },
      {
        headerName: t("doc.columns.brand"),
        colId: "brand",
        width: 110,
        valueGetter: (params) => {
          const id = params.data?.brandId;
          if (!id) return "";
          const b = brandRepository.getById(id);
          return b?.name ?? "";
        },
      },
      {
        headerName: t("doc.columns.category"),
        colId: "category",
        width: 120,
        valueGetter: (params) => {
          const id = params.data?.categoryId;
          if (!id) return "";
          const c = categoryRepository.getById(id);
          return c?.name ?? "";
        },
      },
      {
        field: "uom",
        headerName: t("doc.columns.uom"),
        width: 90,
      },
      {
        field: "purchasePrice",
        headerName: t("doc.columns.purchasePrice"),
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? formatMoney(params.value, 2, "")
            : "",
      },
      {
        field: "salePrice",
        headerName: t("doc.columns.salePrice"),
        width: 100,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? formatMoney(params.value, 2, "")
            : "",
      },
      {
        field: "isActive",
        headerName: t("doc.columns.active"),
        width: 100,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
    ],
    [t, locale, formatMoney],
  );

  const {
    columnDefs: settingsAwareBaseColumnDefs,
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
  } = useAgGridColumnSettings<Item>({
    pageKey: "items",
    entityType: "items",
    baseColumnDefs,
  });
  const effectiveSortModel = useMemo(
    () => {
      const params = new URLSearchParams();
      if (runtimeSortSerialized !== "") params.set("sort", runtimeSortSerialized);
      const runtime = readUrlGridSort(params);
      return runtime.length > 0 ? runtime : deepSortModel;
    },
    [runtimeSortSerialized, deepSortModel],
  );
  const resolveDeepSortValue = useCallback(
    (item: Item, fieldKey: string): unknown => {
      const config = itemColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(item);
      return (item as unknown as Record<string, unknown>)[fieldKey];
    },
    [itemColumnFilterConfigs],
  );

  const displayItemsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayItemsWithQueryFilters, deepFilterModel, itemColumnFilterConfigs),
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

  const noRowsOverlayTemplate = useMemo(
    () =>
      buildAgGridNoRowsOverlayTemplate(
        getAgGridNoRowsOverlayContent(
          {
            baseRowCount: itemRepository.list().length,
            visibleRowCount: displayItems.length,
            searchActive,
            filtersActive,
          },
          t,
        ),
      ),
    [displayItems.length, searchActive, filtersActive, t, locale],
  );

  useAgGridNoRowsOverlayLifecycle(gridRef, noRowsOverlayTemplate, displayItems.length);

  const handleApplyColumnFilter = useCallback(
    (colId: string, clause: { operator: any; value?: string; valueTo?: string; values?: string[] }) => {
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, {
        ...columnFilterModel,
        [colId]: clause,
      });
    },
    [searchParams, setSearchParams, columnFilterModel],
  );

  const handleResetColumnFilter = useCallback(
    (colId: string) => {
      const nextModel = { ...columnFilterModel };
      delete nextModel[colId];
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, nextModel);
    },
    [searchParams, setSearchParams, columnFilterModel],
  );
  const columnFilterBridge = useAgGridColumnFilterBridge(
    columnFilterModel,
    handleApplyColumnFilter,
    handleResetColumnFilter,
  );

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        settingsAwareBaseColumnDefs,
        itemColumnFilterConfigs,
        columnFilterBridge,
      ),
    [
      settingsAwareBaseColumnDefs,
      itemColumnFilterConfigs,
      columnFilterBridge,
    ],
  );
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    applyUrlGridSort(api, effectiveSortModel);
  }, [columnDefs, effectiveSortModel]);

  const handleApplyColumnSettings = useCallback(() => {
    const api = gridRef.current?.api;
    const { hiddenIds, nextItems } = applyColumnSettingsDraft();
    if (api) {
      api.applyColumnState({
        state: nextItems.map((item) => ({
          colId: item.id,
          hide: item.visible ? false : true,
        })),
        applyOrder: true,
      });
    }
    if (hiddenIds.length === 0) return;

    const nextColumnFilterModel = { ...columnFilterModel };
    for (const colId of hiddenIds) {
      delete nextColumnFilterModel[colId];
    }

    const currentSortModel = effectiveSortModel;
    const nextSortModel = currentSortModel.filter((entry) => !hiddenIds.includes(entry.colId));
    const nextParams = withUrlAgGridColumnFilters(searchParams, nextColumnFilterModel);
    const nextSortSerialized = serializeUrlGridSort(nextSortModel);
    if (nextSortSerialized === "") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", nextSortSerialized);
    }
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSortSerialized);
    if (api) {
      applyUrlGridSort(api, nextSortModel);
    }
  }, [
    applyColumnSettingsDraft,
    columnFilterModel,
    effectiveSortModel,
    searchParams,
    setSearchParams,
  ]);

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.list.items.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchQueryChange}
            debounceMs={220}
            aria-label={t("ops.list.items.searchAria")}
            resultCount={displayItems.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
            {brandFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.filterBrandAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.list.filterBrand")}
                </span>
                <span className="truncate font-medium text-foreground/90 min-w-0" title={brandFilterLabel}>
                  {brandFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearBrandFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {categoryFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.filterCategoryAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {t("ops.list.filterCategory")}
                </span>
                <span className="truncate font-medium text-foreground/90 min-w-0" title={categoryFilterLabel}>
                  {categoryFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCategoryFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {exportSuccess && (
              <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">{t("doc.list.exportCompleted")}</span>
                <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
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
            <div className="flex items-stretch rounded-md border border-input shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[1.625rem] rounded-r-none border-0 border-r border-input !px-1 !py-0 !gap-0.5"
                onClick={handleExportCurrentView}
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
                      onClick={() => {
                        setExportOpen(false);
                        if (!exportSelectedDisabled) handleExportSelected();
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
              className="h-[1.625rem] shrink-0"
              onClick={openColumnSettings}
            >
              {t("doc.list.viewSettings")}
            </Button>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="list-page__create-btn rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate(appendReturnTo("/items/new", currentReturnTo))}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg> {t("doc.list.create")}
          </Button>
        </>
      }
    >
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
        <AgGridContainer ref={gridContainerRef} themeClass="items-grid" gridRef={gridRef}>
          <AgGridReact<Item>
            {...agGridDefaultGridOptions}
            ref={gridRef}
            rowData={displayItems}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            overlayNoRowsTemplate={noRowsOverlayTemplate}
            onGridReady={(event) => {
              applyUrlGridSort(event.api, effectiveSortModel);
            }}
            onSortChanged={syncSortToUrl}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => {
              if (hasMeaningfulTextSelection()) return;
              if (e.data) navigate(appendReturnTo(`/items/${e.data.id}`, currentReturnTo));
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
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
          filterConfigs={itemColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
    </ListPageLayout>
  );
}
