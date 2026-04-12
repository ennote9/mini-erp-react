import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { supplierRepository } from "../repository";
import type { Supplier } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import {
  AgGridContainer,
  AgGridActiveBooleanCellRenderer,
  applyAgGridColumnFilters,
  applyDeepSortModel,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  getAgGridRowNumberColDef,
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
import { suppliersListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import { replaceQueryParam } from "@/shared/navigation/returnTo";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  withUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
} from "@/shared/navigation/agGridColumnFilters";

type RowData = Supplier;

export function SuppliersListPage() {
  const location = useLocation();
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const initialSortModel = useMemo(
    () => readUrlGridSort(new URLSearchParams(location.search)),
    [location.search],
  );
  const columnFilterModel = useMemo(
    () => readUrlAgGridColumnFilters(new URLSearchParams(location.search)),
    [location.search],
  );
  const [runtimeSortSerialized, setRuntimeSortSerialized] = useState(() => serializeUrlGridSort(initialSortModel));
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const handleSortChanged = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const nextSortModel = getCurrentGridSort(api, ["selection", "lineNo"]);
    const serialized = serializeUrlGridSort(nextSortModel);
    setRuntimeSortSerialized(serialized);
    replaceQueryParam(searchParams, setSearchParams, "sort", serialized);
  }, [searchParams, setSearchParams]);

  const filteredRows = useMemo(() => {
    return supplierRepository.search(searchQuery);
  }, [searchQuery]);

  const supplierColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<RowData>>>(
    () => ({
      code: { kind: "text" },
      name: { kind: "text" },
      contactPerson: { kind: "text" },
      phone: { kind: "text" },
      email: { kind: "text" },
      city: { kind: "text" },
      paymentTermsDays: { kind: "number" },
      isActive: { kind: "boolean" },
    }),
    [],
  );
  const displayRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, supplierColumnFilterConfigs),
    [filteredRows, columnFilterModel, supplierColumnFilterConfigs],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive = hasActiveAgGridColumnFilters(columnFilterModel);

  const buildExportPayload = useCallback(
    (mode: "current" | "selected"): { headers: string[]; rows: Array<Array<string | number>> } => {
      const api = gridRef.current?.api;
      if (!api) return { headers: [], rows: [] };
      const columns = getVisibleAgGridExportColumns(api, { entityType: "suppliers" });
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

  const listExcelLabels = useMemo(() => suppliersListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const payload = buildExportPayload("current");
    runExportWithSaveAs("suppliers.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "SuppliersListView",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const payload = buildExportPayload("selected");
    if (payload.rows.length === 0) return;
    runExportWithSaveAs("suppliers-selected.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "SuppliersListViewSelected",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emDash = t("domain.audit.summary.emDash");

  const handleApplyColumnFilter = useCallback(
    (colId: string, clause: AgGridColumnFilterClause) => {
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, {
        ...columnFilterModel,
        [colId]: clause,
      });
    },
    [columnFilterModel, searchParams, setSearchParams],
  );

  const handleResetColumnFilter = useCallback(
    (colId: string) => {
      const nextModel = { ...columnFilterModel };
      delete nextModel[colId];
      replaceUrlAgGridColumnFilters(searchParams, setSearchParams, nextModel);
    },
    [columnFilterModel, searchParams, setSearchParams],
  );
  const columnFilterBridge = useAgGridColumnFilterBridge(
    columnFilterModel,
    handleApplyColumnFilter,
    handleResetColumnFilter,
  );

  const baseColumnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      getAgGridRowNumberColDef(t),
      {
        field: "code",
        headerName: t("doc.columns.code"),
        width: 140,
      },
      {
        field: "name",
        headerName: t("doc.columns.name"),
        minWidth: 180,
        flex: 1,
      },
      {
        field: "contactPerson",
        headerName: t("doc.columns.contactPerson"),
        width: 140,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "phone",
        headerName: t("doc.columns.phone"),
        width: 150,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "email",
        headerName: t("doc.columns.email"),
        minWidth: 180,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "city",
        headerName: t("doc.columns.city"),
        width: 120,
        valueFormatter: (params) => params.value ?? emDash,
      },
      {
        field: "paymentTermsDays",
        headerName: t("doc.columns.paymentTerms"),
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? t("doc.summary.paymentTermsDays", { days: params.value })
            : emDash,
      },
      {
        field: "isActive",
        headerName: t("doc.columns.active"),
        width: 110,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
    ],
    [t, locale, emDash],
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
  } = useAgGridColumnSettings<RowData>({
    pageKey: "suppliers",
    entityType: "suppliers",
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
    (row: RowData, fieldKey: string): unknown => {
      const config = supplierColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [supplierColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayRowsWithQueryFilters, deepFilterModel, supplierColumnFilterConfigs),
    [displayRowsWithQueryFilters, deepFilterModel, supplierColumnFilterConfigs],
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
            baseRowCount: supplierRepository.list().length,
            visibleRowCount: displayRows.length,
            searchActive,
            filtersActive,
          },
          t,
        ),
      ),
    [displayRows.length, searchActive, filtersActive, t, locale],
  );
  useAgGridNoRowsOverlayLifecycle(gridRef, noRowsOverlayTemplate, displayRows.length);

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        settingsAwareBaseColumnDefs,
        supplierColumnFilterConfigs,
        columnFilterBridge,
      ),
    [
      settingsAwareBaseColumnDefs,
      supplierColumnFilterConfigs,
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
            placeholder={t("ops.list.suppliers.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.list.suppliers.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
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
            onClick={() => navigate("/suppliers/new")}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg> {t("doc.list.create")}
          </Button>
        </>
      }
    >
      <AgGridContainer themeClass="suppliers-grid" gridRef={gridRef}>
        <AgGridReact<RowData>
          {...agGridDefaultGridOptions}
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
          onRowClicked={(e) => {
            if (hasMeaningfulTextSelection()) return;
            if (e.data) navigate(`/suppliers/${e.data.id}`);
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
        filterConfigs={supplierColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
