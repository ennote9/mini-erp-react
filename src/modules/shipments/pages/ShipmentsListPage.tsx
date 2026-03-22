import React, { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { shipmentRepository } from "../repository";
import { salesOrderRepository } from "../../sales-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { carrierRepository } from "../../carriers/repository";
import type { Shipment } from "../model";
import { buildShipmentListRowExtras } from "../shipmentListRowExtras";
import type { FactualDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  getAgGridRowNumberColDef,
  agGridSelectionColumnDef,
  hasMeaningfulTextSelection,
} from "../../../shared/ui/ag-grid";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { useListPageSearchHotkey } from "../../../shared/hotkeys";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildShipmentsListXlsxBuffer, type ShipmentsExportRow } from "../shipmentsListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";
import { shipmentsListExcelLabels } from "@/shared/i18n/excelListExportLabels";

type StatusFilter = "all" | FactualDocumentStatus;

type RowData = Shipment & {
  salesOrderNumber: string;
  warehouseName: string;
  carrierLabel: string;
  carrierExport: string;
  trackingLabel: string;
  trackingExport: string;
  carrierSearchBlob: string;
  trackingRaw: string;
  trackingUrl: string | null;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    if (r.number.toLowerCase().includes(q)) return true;
    if (r.salesOrderNumber.toLowerCase().includes(q)) return true;
    if (r.warehouseName.toLowerCase().includes(q)) return true;
    if (r.carrierSearchBlob.includes(q)) return true;
    if (r.trackingRaw.toLowerCase().includes(q)) return true;
    return false;
  });
}

function filterByStatus(rows: RowData[], statusFilter: StatusFilter): RowData[] {
  if (statusFilter === "all") return rows;
  return rows.filter((r) => r.status === statusFilter);
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByCarrierId(rows: RowData[], carrierId: string | null): RowData[] {
  if (carrierId == null) return rows;
  return rows.filter((r) => (r.carrierId?.trim() ?? "") === carrierId);
}

function StatusCellRenderer(params: ICellRendererParams<RowData>) {
  const status = params.value as string | undefined;
  if (status == null) return null;
  return <StatusBadge status={status} />;
}

function buildExportRowsFromShipments(rows: RowData[]): ShipmentsExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    number: r.number ?? "",
    date: r.date ?? "",
    salesOrder: r.salesOrderNumber ?? "",
    warehouse: r.warehouseName ?? "",
    carrier: r.carrierExport ?? "",
    trackingNumber: r.trackingExport ?? "",
    status: r.status ?? "",
  }));
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
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  useListPageSearchHotkey(listSearchInputRef);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

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
    const byCarrier = filterByCarrierId(byWarehouse, carrierFilterId);
    return filterByStatus(byCarrier, statusFilter);
  }, [rowsWithNames, searchQuery, statusFilter, warehouseFilterId, carrierFilterId]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter =
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    warehouseFilterId != null ||
    carrierFilterId != null;

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

  const getExportRowsCurrentView = useCallback((): ShipmentsExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromShipments(filteredRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromShipments(rows);
  }, [filteredRows]);

  const getExportRowsSelected = useCallback((): ShipmentsExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromShipments(rows);
  }, []);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: t("doc.page.excelFilterName"), extensions: ["xlsx"] }],
        });
        if (path == null) return;

        const buffer = await buildBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const contentsBase64 = btoa(binary);

        await invoke("write_export_file", { path, contentsBase64 });
        const filename = path.replace(/^.*[/\\]/, "") || defaultFilename;
        setExportSuccess({ path, filename });
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
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("shipments.xlsx", () => buildShipmentsListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsCurrentView, listExcelLabels, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("shipments-selected.xlsx", () => buildShipmentsListXlsxBuffer(rows, listExcelLabels));
  }, [getExportRowsSelected, listExcelLabels, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? t("ops.list.shipments.emptyFiltered")
    : t("ops.list.shipments.emptyDefault");
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return t("ops.list.shipments.hintCreate");
    }
    if (
      carrierFilterId != null &&
      warehouseFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.shipments.hintCarrierOnly");
    }
    if (
      warehouseFilterId != null &&
      carrierFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.shipments.hintWarehouseOnly");
    }
    return t("ops.list.shipments.hintSearchStatusWarehouse");
  }, [
    hasFilter,
    warehouseFilterId,
    carrierFilterId,
    statusFilter,
    searchQuery,
    t,
    locale,
  ]);

  const statusOptions = useMemo(
    (): { value: StatusFilter; label: string }[] => [
      { value: "all", label: t("doc.list.all") },
      { value: "draft", label: t("status.factual.draft") },
      { value: "posted", label: t("status.factual.posted") },
      { value: "reversed", label: t("status.factual.reversed") },
      { value: "cancelled", label: t("status.factual.cancelled") },
    ],
    [t, locale],
  );

  const columnDefs = useMemo<ColDef<RowData>[]>(
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
        field: "status",
        headerName: t("doc.columns.status"),
        width: 130,
        cellRenderer: StatusCellRenderer,
      },
    ],
    [t, locale],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label={t("doc.list.backToDashboard")} />
          <ButtonGroup className="list-page__filter-group" aria-label={t("ops.list.filterStatusAria")}>
            {statusOptions.map(({ value, label }, index) => (
              <React.Fragment key={value}>
                {index > 0 && <ButtonGroupSeparator />}
                <Button
                  type="button"
                  variant={statusFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </Button>
              </React.Fragment>
            ))}
          </ButtonGroup>
          <ListPageSearch
            inputRef={listSearchInputRef}
            placeholder={t("ops.list.shipments.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.list.shipments.searchAria")}
            resultCount={filteredRows.length}
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
                className="h-8 rounded-r-none border-0 border-r border-input gap-1.5"
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
                    className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
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
          </div>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="shipments-grid">
          <AgGridReact<RowData>
            {...agGridDefaultGridOptions}
            ref={gridRef}
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
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
      )}
    </ListPageLayout>
  );
}
