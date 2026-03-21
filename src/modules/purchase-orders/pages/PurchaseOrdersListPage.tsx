import React, { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { purchaseOrderRepository } from "../repository";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { normalizeDateForPO } from "../dateUtils";
import type { PurchaseOrder } from "../model";
import type { PlanningDocumentStatus } from "../../../shared/domain";
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
import { buildPurchaseOrdersListXlsxBuffer, type PurchaseOrdersExportRow } from "../purchaseOrdersListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/shared/i18n/context";

type StatusFilter = "all" | PlanningDocumentStatus;

type RowData = PurchaseOrder & {
  supplierName: string;
  warehouseName: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.number.toLowerCase().includes(q) ||
      r.supplierName.toLowerCase().includes(q),
  );
}

function filterByStatus(
  rows: RowData[],
  statusFilter: StatusFilter,
): RowData[] {
  if (statusFilter === "all") return rows;
  return rows.filter((r) => r.status === statusFilter);
}

function filterBySupplierId(rows: RowData[], supplierId: string | null): RowData[] {
  if (supplierId == null) return rows;
  return rows.filter((r) => r.supplierId === supplierId);
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

/** When `allowIds` is null, no item filter is applied. */
function filterByDocumentIdSet(rows: RowData[], allowIds: Set<string> | null): RowData[] {
  if (allowIds == null) return rows;
  return rows.filter((r) => allowIds.has(r.id));
}

function parseQueryId(searchParams: URLSearchParams, key: string): string | null {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

function StatusCellRenderer(params: ICellRendererParams<RowData>) {
  const status = params.value as string | undefined;
  if (status == null) return null;
  return <StatusBadge status={status} />;
}

function buildExportRowsFromPO(rows: RowData[]): PurchaseOrdersExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    number: r.number ?? "",
    date: normalizeDateForPO(r.date),
    supplier: r.supplierName ?? "",
    warehouse: r.warehouseName ?? "",
    status: r.status ?? "",
  }));
}

export function PurchaseOrdersListPage() {
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilterId = useMemo(() => parseQueryId(searchParams, "supplierId"), [searchParams]);
  const warehouseFilterId = useMemo(() => parseQueryId(searchParams, "warehouseId"), [searchParams]);
  const itemFilterId = useMemo(() => parseQueryId(searchParams, "itemId"), [searchParams]);

  const purchaseOrderIdsContainingItem = useMemo(() => {
    if (itemFilterId == null) return null;
    const ids = new Set<string>();
    for (const po of purchaseOrderRepository.list()) {
      const lines = purchaseOrderRepository.listLines(po.id);
      for (const line of lines) {
        if (line.itemId === itemFilterId) {
          ids.add(po.id);
          break;
        }
      }
    }
    return ids;
  }, [itemFilterId]);

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
    const list = purchaseOrderRepository.list();
    return list.map((po) => {
      const supplier = supplierRepository.getById(po.supplierId);
      const warehouse = warehouseRepository.getById(po.warehouseId);
      return {
        ...po,
        supplierName: supplier?.name ?? po.supplierId,
        warehouseName: warehouse?.name ?? po.warehouseId,
      };
    });
  }, []);

  const filteredRows = useMemo(() => {
    let next = filterBySearch(rowsWithNames, searchQuery);
    next = filterBySupplierId(next, supplierFilterId);
    next = filterByWarehouseId(next, warehouseFilterId);
    next = filterByDocumentIdSet(next, purchaseOrderIdsContainingItem);
    return filterByStatus(next, statusFilter);
  }, [
    rowsWithNames,
    searchQuery,
    statusFilter,
    supplierFilterId,
    warehouseFilterId,
    purchaseOrderIdsContainingItem,
  ]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter =
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    supplierFilterId != null ||
    warehouseFilterId != null ||
    itemFilterId != null;

  const supplierFilterLabel = useMemo((): string => {
    if (supplierFilterId == null) return "";
    const s = supplierRepository.getById(supplierFilterId);
    if (s) return s.name || s.code || supplierFilterId;
    return supplierFilterId;
  }, [supplierFilterId]);

  const clearSupplierFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("supplierId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const emDash = t("domain.audit.summary.emDash");

  const itemFilterLabel = useMemo((): string => {
    if (itemFilterId == null) return "";
    const it = itemRepository.getById(itemFilterId);
    if (it) {
      const code = it.code?.trim() ?? "";
      const name = it.name?.trim() ?? "";
      if (code && name) return `${code} ${emDash} ${name}`;
      return code || name || itemFilterId;
    }
    return itemFilterId;
  }, [itemFilterId, emDash]);

  const getExportRowsCurrentView = useCallback((): PurchaseOrdersExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromPO(filteredRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromPO(rows);
  }, [filteredRows]);

  const getExportRowsSelected = useCallback((): PurchaseOrdersExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromPO(rows);
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

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("purchase-orders.xlsx", () => buildPurchaseOrdersListXlsxBuffer(rows));
  }, [getExportRowsCurrentView, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("purchase-orders-selected.xlsx", () => buildPurchaseOrdersListXlsxBuffer(rows));
  }, [getExportRowsSelected, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? t("ops.list.purchaseOrders.emptyFiltered")
    : t("ops.list.purchaseOrders.emptyDefault");
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return t("ops.list.purchaseOrders.hintCreate");
    }
    if (
      supplierFilterId != null &&
      warehouseFilterId == null &&
      itemFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.purchaseOrders.hintSupplierOnly");
    }
    if (
      warehouseFilterId != null &&
      itemFilterId == null &&
      supplierFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.purchaseOrders.hintWarehouseOnly");
    }
    if (
      itemFilterId != null &&
      warehouseFilterId == null &&
      supplierFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return t("ops.list.purchaseOrders.hintItemOnly");
    }
    return t("ops.list.purchaseOrders.hintUrlFilters");
  }, [
    hasFilter,
    supplierFilterId,
    warehouseFilterId,
    itemFilterId,
    statusFilter,
    searchQuery,
    t,
    locale,
  ]);

  const statusOptions = useMemo(
    (): { value: StatusFilter; label: string }[] => [
      { value: "all", label: t("doc.list.all") },
      { value: "draft", label: t("status.planning.draft") },
      { value: "confirmed", label: t("status.planning.confirmed") },
      { value: "closed", label: t("status.planning.closed") },
      { value: "cancelled", label: t("status.planning.cancelled") },
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
        valueFormatter: (params) => normalizeDateForPO(params.value),
      },
      {
        field: "supplierName",
        headerName: t("doc.columns.supplier"),
        minWidth: 180,
      },
      {
        field: "warehouseName",
        headerName: t("doc.columns.warehouse"),
        minWidth: 160,
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
            placeholder={t("ops.list.purchaseOrders.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t("ops.list.purchaseOrders.searchAria")}
            resultCount={filteredRows.length}
          />
          <div className="flex flex-row flex-wrap items-center gap-2 shrink-0 ml-auto justify-end">
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.purchaseOrders.filterWarehouseAria")}
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
            {itemFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,20rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.purchaseOrders.filterItemAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.page.itemLabel")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={itemFilterLabel}
                >
                  {itemFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearItemFilter}
                >
                  {t("doc.list.clear")}
                </Button>
              </div>
            )}
            {supplierFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label={t("ops.list.purchaseOrders.filterSupplierAria")}
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">{t("doc.columns.supplier")}</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={supplierFilterLabel}
                >
                  {supplierFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearSupplierFilter}
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
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate("/purchase-orders/new")}
          >
            <span className="create-btn__plus">+</span> {t("doc.list.create")}
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="purchase-orders-grid">
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
              if (e.data) navigate(`/purchase-orders/${e.data.id}`);
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
