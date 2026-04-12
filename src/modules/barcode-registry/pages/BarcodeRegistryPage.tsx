import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClickedEvent, SelectionChangedEvent } from "ag-grid-community";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, File, FileSpreadsheet, FolderOpen, ScanBarcode, SlidersHorizontal, TicketPercent, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { type ItemBarcodeSymbology } from "@/modules/items";
import { useTranslation } from "@/shared/i18n/context";
import { barcodeRegistryListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import {
  AgGridActiveBooleanCellRenderer,
  AgGridColumnSettingsModal,
  AgGridContainer,
  GridOutlinePillBadge,
  applyAgGridColumnFilters,
  applyDeepSortModel,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  getAgGridRowNumberColDef,
  agGridSelectionColumnDef,
  buildExportMatrixFromRowNodes,
  buildAgGridNoRowsOverlayTemplate,
  collectFilteredSortedRowNodes,
  decorateAgGridColumnDefsWithFilters,
  getAgGridNoRowsOverlayContent,
  getVisibleAgGridExportColumns,
  hasMeaningfulTextSelection,
  type AgGridColumnFilterConfig,
  useAgGridColumnFilterBridge,
  useAgGridColumnSettings,
  useAgGridNoRowsOverlayLifecycle,
} from "@/shared/ui/ag-grid";
import { ListPageLayout } from "@/shared/ui/list/ListPageLayout";
import { ListPageSearch } from "@/shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "@/shared/hotkeys";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import {
  listBarcodeRegistryRows,
  type BarcodeRegistryEntryType,
  type BarcodeRegistryRow,
  type BarcodeRegistrySource,
} from "../barcodeRegistryReadModel";
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import { appendReturnTo, buildNavigationStateKey, buildReturnToValue, replaceQueryParam } from "@/shared/navigation/returnTo";
import { useSessionScrollRestore } from "@/shared/navigation/useSessionScrollRestore";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
  withUrlAgGridColumnFilters,
} from "@/shared/navigation/agGridColumnFilters";

function EntryTypeCellRenderer(params: ICellRendererParams<BarcodeRegistryRow, BarcodeRegistryEntryType>) {
  if (params.value === "MARKDOWN_CODE") {
    return (
      <GridOutlinePillBadge tone="warning">
        <TicketPercent className="mr-1 h-3 w-3" />
        {params.context.entryTypeLabel(params.value)}
      </GridOutlinePillBadge>
    );
  }
  return (
    <GridOutlinePillBadge tone="muted">
      <ScanBarcode className="mr-1 h-3 w-3" />
      {params.context.entryTypeLabel(params.value ?? "ITEM_BARCODE")}
    </GridOutlinePillBadge>
  );
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
  const appRevision = useAppReadModelRevision();
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact<BarcodeRegistryRow> | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const searchQuery = searchParams.get("q") ?? "";
  const [selectedCount, setSelectedCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState("");
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
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

  useEffect(() => {
    setRuntimeSortSerialized(serializeUrlGridSort(initialSortModel));
  }, [initialSortModel]);

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

  const sourceOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.source))];
    return values
      .sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b), locale))
      .map((value) => ({
        value,
        label: sourceLabel(value),
      }));
  }, [rows, sourceLabel, locale]);

  const filteredRows = useMemo(() => filterRows(rows, searchQuery), [rows, searchQuery]);

  const barcodeColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<BarcodeRegistryRow>>>(
    () => ({
      code: { kind: "text" },
      entryType: {
        kind: "enum",
        options: [
          { value: "ITEM_BARCODE", label: entryTypeLabel("ITEM_BARCODE") },
          { value: "MARKDOWN_CODE", label: entryTypeLabel("MARKDOWN_CODE") },
        ],
      },
      itemCode: { kind: "text" },
      itemName: { kind: "text" },
      isActive: { kind: "boolean" },
      source: {
        kind: "enum",
        options: sourceOptions,
      },
      createdAt: { kind: "datetime" },
      symbology: {
        kind: "enum",
        options: [...new Set(rows.map((row) => row.symbology).filter(Boolean))].map((value) => ({
          value: String(value),
          label: symbologyLabel(value as ItemBarcodeSymbology),
        })),
      },
      markdownJournalNumber: { kind: "text" },
      markdownStatus: {
        kind: "enum",
        options: [...new Set(rows.map((row) => row.markdownStatus).filter(Boolean))].map((value) => ({
          value: String(value),
          label: markdownStatusLabel(String(value)),
        })),
      },
    }),
    [entryTypeLabel, markdownStatusLabel, rows, sourceOptions, symbologyLabel],
  );

  const displayRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, barcodeColumnFilterConfigs),
    [filteredRows, columnFilterModel, barcodeColumnFilterConfigs],
  );

  const handleSortChanged = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const serialized = serializeUrlGridSort(getCurrentGridSort(api, ["selection", "lineNo"]));
    setRuntimeSortSerialized(serialized);
    replaceQueryParam(searchParams, setSearchParams, "sort", serialized);
  }, [searchParams, setSearchParams]);

  const baseColumnDefs = useMemo<ColDef<BarcodeRegistryRow>[]>(
    () => [
      getAgGridRowNumberColDef(t),
      {
        field: "code",
        headerName: t("exportExcel.list.colCode"),
        minWidth: 170,
        width: 190,
      },
      {
        field: "entryType",
        headerName: t("exportExcel.list.colEntryType"),
        minWidth: 140,
        width: 160,
        cellRenderer: EntryTypeCellRenderer,
      },
      {
        field: "itemCode",
        headerName: t("exportExcel.list.colItemCode"),
        minWidth: 120,
        width: 140,
      },
      {
        field: "itemName",
        headerName: t("exportExcel.list.colItemName"),
        minWidth: 220,
        flex: 1,
      },
      {
        field: "isActive",
        headerName: t("exportExcel.list.colActive"),
        minWidth: 110,
        width: 120,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
      {
        field: "source",
        headerName: t("exportExcel.list.colSource"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => sourceLabel(params.value as BarcodeRegistrySource),
      },
      {
        field: "createdAt",
        headerName: t("exportExcel.list.colCreated"),
        minWidth: 160,
        width: 180,
        valueFormatter: (params) => params.value || t("domain.audit.summary.emDash"),
      },
      {
        field: "symbology",
        headerName: t("exportExcel.list.colSymbology"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => symbologyLabel(params.value as ItemBarcodeSymbology | undefined),
      },
      {
        field: "markdownJournalNumber",
        headerName: t("exportExcel.list.colMarkdownJournal"),
        minWidth: 130,
        width: 150,
        valueFormatter: (params) => params.value || t("domain.audit.summary.emDash"),
      },
      {
        field: "markdownStatus",
        headerName: t("exportExcel.list.colRecordStatus"),
        minWidth: 120,
        width: 140,
        valueFormatter: (params) => markdownStatusLabel(params.value as string | undefined),
      },
    ],
    [markdownStatusLabel, sourceLabel, symbologyLabel, t],
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
  } = useAgGridColumnSettings<BarcodeRegistryRow>({
    pageKey: "barcodes",
    entityType: "barcodes",
    baseColumnDefs,
  });

  const effectiveSortModel = useMemo(() => {
    const params = new URLSearchParams();
    if (runtimeSortSerialized !== "") params.set("sort", runtimeSortSerialized);
    const runtime = readUrlGridSort(params);
    return runtime.length > 0 ? runtime : deepSortModel;
  }, [runtimeSortSerialized, deepSortModel]);

  const resolveDeepSortValue = useCallback(
    (row: BarcodeRegistryRow, fieldKey: string): unknown => {
      const config = barcodeColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [barcodeColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayRowsWithQueryFilters, deepFilterModel, barcodeColumnFilterConfigs),
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

  const noRowsOverlayTemplate = useMemo(
    () =>
      buildAgGridNoRowsOverlayTemplate(
        getAgGridNoRowsOverlayContent(
          {
            baseRowCount: rows.length,
            visibleRowCount: displayRows.length,
            searchActive: searchQuery.trim() !== "",
            filtersActive: hasActiveAgGridColumnFilters(columnFilterModel),
          },
          t,
        ),
      ),
    [rows.length, displayRows.length, searchQuery, columnFilterModel, t, locale],
  );

  useAgGridNoRowsOverlayLifecycle(gridRef, noRowsOverlayTemplate, displayRows.length);

  const buildExportPayload = useCallback(
    (mode: "current" | "selected"): { headers: string[]; rows: Array<Array<string | number>> } => {
      const api = gridRef.current?.api;
      if (!api) return { headers: [], rows: [] };
      const columns = getVisibleAgGridExportColumns(api, { entityType: "barcodes" });
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
        const base = defaultFilename.replace(/\.[^.]+$/, "");
        const generatedFilename = buildReadableUniqueFilename({ base, extension: "xlsx" });
        const path = await save({
          defaultPath: generatedFilename,
          filters: [{ name: t("ops.importModal.excelFileFilterName"), extensions: ["xlsx"] }],
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
        void err;
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

  const listExcelLabels = useMemo(() => barcodeRegistryListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const payload = buildExportPayload("current");
    runExportWithSaveAs("barcode-registry.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "BarcodeRegistryListView",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const payload = buildExportPayload("selected");
    if (payload.rows.length === 0) return;
    runExportWithSaveAs("barcode-registry-selected.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "BarcodeRegistryListViewSelected",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<BarcodeRegistryRow>) => {
    setSelectedCount(event.api.getSelectedRows().length);
  }, []);

  const onRowClicked = useCallback(
    (event: RowClickedEvent<BarcodeRegistryRow>) => {
      if (hasMeaningfulTextSelection()) return;
      if (!event.data) return;
      navigate(appendReturnTo(event.data.nativePath, currentReturnTo));
    },
    [navigate, currentReturnTo],
  );

  const handleApplyColumnFilter = useCallback(
    (colId: string, clause: AgGridColumnFilterClause) => {
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
        barcodeColumnFilterConfigs,
        columnFilterBridge,
      ),
    [
      settingsAwareBaseColumnDefs,
      barcodeColumnFilterConfigs,
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
    for (const colId of hiddenIds) delete nextColumnFilterModel[colId];
    const nextSortModel = effectiveSortModel.filter((entry) => !hiddenIds.includes(entry.colId));
    const nextParams = withUrlAgGridColumnFilters(searchParams, nextColumnFilterModel);
    const nextSortSerialized = serializeUrlGridSort(nextSortModel);
    if (nextSortSerialized === "") nextParams.delete("sort");
    else nextParams.set("sort", nextSortSerialized);
    setSearchParams(nextParams, { replace: true });
    setRuntimeSortSerialized(nextSortSerialized);
    if (api) applyUrlGridSort(api, nextSortModel);
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
        <div className="list-page__controls-stack flex w-full min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ListPageSearch
              inputRef={listSearchInputRef}
              placeholder={t("ops.list.barcodeRegistry.searchPlaceholder")}
              value={searchQuery}
              onChange={(value) => replaceQueryParam(searchParams, setSearchParams, "q", value, "")}
              debounceMs={220}
              aria-label={t("ops.list.barcodeRegistry.searchAria")}
              resultCount={displayRows.length}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {exportSuccess && (
                <div className="flex h-8 max-w-[min(100%,24rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
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
                        disabled={selectedCount === 0}
                        className="w-full rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        title={selectedCount === 0 ? t("doc.list.selectRowsForExport") : undefined}
                        onClick={() => {
                          setExportOpen(false);
                          if (selectedCount > 0) handleExportSelected();
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
                className="h-[1.625rem] shrink-0 !px-1 !py-0 !gap-0.5"
                onClick={openColumnSettings}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                {t("doc.list.viewSettings")}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <AgGridContainer ref={gridContainerRef} themeClass="barcode-registry-grid" gridRef={gridRef}>
        <AgGridReact<BarcodeRegistryRow>
          {...agGridDefaultGridOptions}
          context={{ entryTypeLabel }}
          ref={gridRef}
          rowData={displayRows}
          columnDefs={columnDefs}
          defaultColDef={agGridDefaultColDef}
          overlayNoRowsTemplate={noRowsOverlayTemplate}
          onGridReady={(event) => {
            applyUrlGridSort(event.api, effectiveSortModel);
          }}
          onSortChanged={handleSortChanged}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
          selectionColumnDef={agGridSelectionColumnDef}
          getRowId={(params) => params.data.id}
          onSelectionChanged={onSelectionChanged}
          onRowClicked={onRowClicked}
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
        filterConfigs={barcodeColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
    </ListPageLayout>
  );
}
