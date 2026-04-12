import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { shipmentRepository } from "../repository";
import { salesOrderRepository } from "../../sales-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { carrierRepository } from "../../carriers/repository";
import type { Shipment } from "../model";
import {
  buildShipmentListRowExtras,
  type ShipmentListRowExtras,
} from "../shipmentListRowExtras";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import {
  AgGridContainer,
  AgGridFactualStatusCellRenderer,
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
import { useAppDisplayFormatters } from "@/shared/formatting";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";
import { shipmentsListExcelLabels } from "@/shared/i18n/excelListExportLabels";
import { buildListViewXlsxBuffer } from "@/shared/export/listViewXlsx";
import { toGeneratedCodeSearchTokens } from "@/shared/generatedVisibleCodes";
import { applyUrlGridSort, getCurrentGridSort, readUrlGridSort, serializeUrlGridSort } from "@/shared/navigation/agGridSort";
import { replaceQueryParam } from "@/shared/navigation/returnTo";
import {
  hasActiveAgGridColumnFilters,
  readUrlAgGridColumnFilters,
  replaceUrlAgGridColumnFilters,
  withUrlAgGridColumnFilters,
  type AgGridColumnFilterClause,
} from "@/shared/navigation/agGridColumnFilters";

type RowData = Shipment & {
  salesOrderNumber: string;
  warehouseName: string;
} & ShipmentListRowExtras;

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const codeTokens = toGeneratedCodeSearchTokens(q);
  return rows.filter((r) => {
    const n = r.number.toLowerCase();
    const nCompact = n.replace(/[^a-z0-9]/g, "");
    if (n.includes(q) || codeTokens.some((t) => n.includes(t) || nCompact.includes(t))) return true;
    const so = r.salesOrderNumber.toLowerCase();
    const soCompact = so.replace(/[^a-z0-9]/g, "");
    if (so.includes(q) || codeTokens.some((t) => so.includes(t) || soCompact.includes(t))) return true;
    if (r.warehouseName.toLowerCase().includes(q)) return true;
    if (r.carrierSearchBlob.includes(q)) return true;
    if (r.trackingRaw.toLowerCase().includes(q)) return true;
    if (r.deliveryMetaSearchBlob.includes(q)) return true;
    return false;
  });
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByCarrierId(rows: RowData[], carrierId: string | null): RowData[] {
  if (carrierId == null) return rows;
  return rows.filter((r) => (r.carrierId?.trim() ?? "") === carrierId);
}

function TrackingListCellRenderer(params: ICellRendererParams<RowData>) {
  const { t } = useTranslation();
  const data = params.data;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <span className="truncate min-w-0" title={data.trackingRaw || undefined}>
        {data.trackingLabel}
      </span>
      {data.trackingUrl ? (
        <a
          href={data.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-primary underline-offset-4 hover:underline whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
          onAuxClick={(e) => e.stopPropagation()}
        >
          {t("ops.list.shipments.openTracking")}
        </a>
      ) : null}
    </div>
  );
}

export function ShipmentsListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { formatDate } = useAppDisplayFormatters();
  const [searchParams, setSearchParams] = useSearchParams();
  const warehouseFilterId = useMemo(() => {
    const raw = searchParams.get("warehouseId");
    if (raw == null || raw === "") return null;
    const w = raw.trim();
    return w === "" ? null : w;
  }, [searchParams]);

  const carrierFilterId = useMemo(() => {
    const raw = searchParams.get("carrierId");
    if (raw == null || raw === "") return null;
    const c = raw.trim();
    return c === "" ? null : c;
  }, [searchParams]);

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

  const rowsWithNames = useMemo(() => {
    const list = shipmentRepository.list();
    const emDash = t("domain.audit.summary.emDash");
    const unknownCarrier = t("doc.shipment.unknownCarrier");
    return list.map((s) => {
      const so = salesOrderRepository.getById(s.salesOrderId);
      const warehouse = warehouseRepository.getById(s.warehouseId);
      const x = buildShipmentListRowExtras(s, { emDash, unknownCarrier });
      return {
        ...s,
        salesOrderNumber: so?.number ?? s.salesOrderId,
        warehouseName: warehouse?.name ?? s.warehouseId,
        ...x,
      };
    });
  }, [t, locale]);

  const filteredRows = useMemo(() => {
    const bySearch = filterBySearch(rowsWithNames, searchQuery);
    const byWarehouse = filterByWarehouseId(bySearch, warehouseFilterId);
    return filterByCarrierId(byWarehouse, carrierFilterId);
  }, [rowsWithNames, searchQuery, warehouseFilterId, carrierFilterId]);

  const factualStatusOptions = useMemo(
    () => [
      { value: "draft", label: t("status.factual.draft") },
      { value: "posted", label: t("status.factual.posted") },
      { value: "reversed", label: t("status.factual.reversed") },
      { value: "cancelled", label: t("status.factual.cancelled") },
    ],
    [t, locale],
  );

  const shipmentColumnFilterConfigs = useMemo<Record<string, AgGridColumnFilterConfig<RowData>>>(
    () => ({
      number: { kind: "text" },
      date: { kind: "date" },
      salesOrderNumber: { kind: "text" },
      warehouseName: {
        kind: "enum",
        options: Array.from(new Set(rowsWithNames.map((row) => row.warehouseName)))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value })),
      },
      carrierLabel: { kind: "text" },
      trackingLabel: { kind: "text", getValue: (row) => row.trackingRaw },
      recipientLabel: { kind: "text" },
      recipientPhoneLabel: { kind: "text" },
      deliveryAddressPreview: { kind: "text" },
      status: {
        kind: "enum",
        options: factualStatusOptions,
      },
    }),
    [rowsWithNames, factualStatusOptions],
  );

  const displayRowsWithQueryFilters = useMemo(
    () => applyAgGridColumnFilters(filteredRows, columnFilterModel, shipmentColumnFilterConfigs),
    [filteredRows, columnFilterModel, shipmentColumnFilterConfigs],
  );

  const searchActive = searchQuery.trim() !== "";
  const filtersActive =
    warehouseFilterId != null ||
    carrierFilterId != null ||
    hasActiveAgGridColumnFilters(columnFilterModel);

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const carrierFilterLabel = useMemo((): string => {
    if (carrierFilterId == null) return "";
    const c = carrierRepository.getById(carrierFilterId);
    if (c) return c.name || c.code || carrierFilterId;
    return carrierFilterId;
  }, [carrierFilterId]);

  const clearWarehouseFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("warehouseId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearCarrierFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("carrierId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const buildExportPayload = useCallback(
    (mode: "current" | "selected"): { headers: string[]; rows: Array<Array<string | number>> } => {
      const api = gridRef.current?.api;
      if (!api) return { headers: [], rows: [] };
      const columns = getVisibleAgGridExportColumns(api, { entityType: "shipments" });
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

  const listExcelLabels = useMemo(() => shipmentsListExcelLabels(t), [t, locale]);

  const handleExportCurrentView = useCallback(() => {
    const payload = buildExportPayload("current");
    runExportWithSaveAs("shipments.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "ShipmentsListView",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const payload = buildExportPayload("selected");
    if (payload.rows.length === 0) return;
    runExportWithSaveAs("shipments-selected.xlsx", () =>
      buildListViewXlsxBuffer({
        sheetName: listExcelLabels.sheetName,
        headers: payload.headers,
        rows: payload.rows,
        tableNameBase: "ShipmentsListViewSelected",
      }),
    );
  }, [buildExportPayload, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

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
        field: "number",
        headerName: t("doc.columns.number"),
        width: 150,
      },
      {
        field: "date",
        headerName: t("doc.columns.date"),
        width: 140,
        valueFormatter: (params) => formatDate(params.value, { empty: "" }),
      },
      {
        field: "salesOrderNumber",
        headerName: t("doc.columns.salesOrder"),
        minWidth: 180,
      },
      {
        field: "warehouseName",
        headerName: t("doc.columns.warehouse"),
        minWidth: 160,
      },
      {
        field: "carrierLabel",
        headerName: t("doc.shipment.carrier"),
        minWidth: 140,
        maxWidth: 220,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "trackingLabel",
        headerName: t("doc.shipment.trackingNumber"),
        minWidth: 160,
        flex: 1,
        cellRenderer: TrackingListCellRenderer,
      },
      {
        field: "recipientLabel",
        headerName: t("doc.shipment.recipientName"),
        minWidth: 130,
        maxWidth: 200,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "recipientPhoneLabel",
        headerName: t("doc.shipment.recipientPhone"),
        minWidth: 120,
        maxWidth: 160,
        valueFormatter: (p) => String(p.value ?? ""),
      },
      {
        field: "deliveryAddressPreview",
        headerName: t("doc.shipment.deliveryAddress"),
        minWidth: 120,
        maxWidth: 200,
        valueFormatter: (p) => String(p.value ?? ""),
        tooltipValueGetter: (p) => {
          const full = p.data?.deliveryAddressFull ?? "";
          return full.trim() === "" ? undefined : full;
        },
      },
      {
        field: "status",
        headerName: t("doc.columns.status"),
        width: 130,
        cellRenderer: AgGridFactualStatusCellRenderer,
      },
    ],
    [t, locale, formatDate],
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
    pageKey: "shipments",
    entityType: "shipments",
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
      const config = shipmentColumnFilterConfigs[fieldKey];
      if (config?.getValue) return config.getValue(row);
      return (row as unknown as Record<string, unknown>)[fieldKey];
    },
    [shipmentColumnFilterConfigs],
  );

  const displayRowsWithDeepFilters = useMemo(
    () => applyAgGridColumnFilters(displayRowsWithQueryFilters, deepFilterModel, shipmentColumnFilterConfigs),
    [displayRowsWithQueryFilters, deepFilterModel, shipmentColumnFilterConfigs],
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
            baseRowCount: rowsWithNames.length,
            visibleRowCount: displayRows.length,
            searchActive,
            filtersActive,
          },
          t,
        ),
      ),
    [rowsWithNames.length, displayRows.length, searchActive, filtersActive, t, locale],
  );

  useAgGridNoRowsOverlayLifecycle(gridRef, noRowsOverlayTemplate, displayRows.length);

  const columnDefs = useMemo(
    () =>
      decorateAgGridColumnDefsWithFilters(
        settingsAwareBaseColumnDefs,
        shipmentColumnFilterConfigs,
        columnFilterBridge,
      ),
    [
      settingsAwareBaseColumnDefs,
      shipmentColumnFilterConfigs,
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
            placeholder={t("ops.list.shipments.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.list.shipments.searchAria")}
            resultCount={displayRows.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.shipments.filterWarehouseAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.columns.warehouse")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={warehouseFilterLabel}
                >
                  {warehouseFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearWarehouseFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {carrierFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.shipments.filterCarrierAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.shipment.carrier")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={carrierFilterLabel}
                >
                  {carrierFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCarrierFilter}
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
        </>
      }
    >
      <AgGridContainer themeClass="shipments-grid" gridRef={gridRef}>
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
            if (e.data) navigate(`/shipments/${e.data.id}`);
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
        filterConfigs={shipmentColumnFilterConfigs as Record<string, AgGridColumnFilterConfig<unknown>>}
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
