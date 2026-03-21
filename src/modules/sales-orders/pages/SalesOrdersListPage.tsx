import React, { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { salesOrderRepository } from "../repository";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { itemRepository } from "../../items/repository";
import { normalizeDateForSO } from "../dateUtils";
import type { SalesOrder } from "../model";
import type { PlanningDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridDefaultGridOptions,
  agGridRowNumberColDef,
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
import { buildSalesOrdersListXlsxBuffer, type SalesOrdersExportRow } from "../salesOrdersListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

type StatusFilter = "all" | PlanningDocumentStatus;

type RowData = SalesOrder & {
  customerName: string;
  warehouseName: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.number.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q),
  );
}

function filterByStatus(
  rows: RowData[],
  statusFilter: StatusFilter,
): RowData[] {
  if (statusFilter === "all") return rows;
  return rows.filter((r) => r.status === statusFilter);
}

function filterByCustomerId(rows: RowData[], customerId: string | null): RowData[] {
  if (customerId == null) return rows;
  return rows.filter((r) => r.customerId === customerId);
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

function buildExportRowsFromSO(rows: RowData[]): SalesOrdersExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    number: r.number ?? "",
    date: normalizeDateForSO(r.date),
    customer: r.customerName ?? "",
    warehouse: r.warehouseName ?? "",
    status: r.status ?? "",
  }));
}

export function SalesOrdersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerFilterId = useMemo(() => parseQueryId(searchParams, "customerId"), [searchParams]);
  const warehouseFilterId = useMemo(() => parseQueryId(searchParams, "warehouseId"), [searchParams]);
  const itemFilterId = useMemo(() => parseQueryId(searchParams, "itemId"), [searchParams]);

  const salesOrderIdsContainingItem = useMemo(() => {
    if (itemFilterId == null) return null;
    const ids = new Set<string>();
    for (const so of salesOrderRepository.list()) {
      const lines = salesOrderRepository.listLines(so.id);
      for (const line of lines) {
        if (line.itemId === itemFilterId) {
          ids.add(so.id);
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
    const list = salesOrderRepository.list();
    return list.map((so) => {
      const customer = customerRepository.getById(so.customerId);
      const warehouse = warehouseRepository.getById(so.warehouseId);
      return {
        ...so,
        customerName: customer?.name ?? so.customerId,
        warehouseName: warehouse?.name ?? so.warehouseId,
      };
    });
  }, []);

  const filteredRows = useMemo(() => {
    let next = filterBySearch(rowsWithNames, searchQuery);
    next = filterByCustomerId(next, customerFilterId);
    next = filterByWarehouseId(next, warehouseFilterId);
    next = filterByDocumentIdSet(next, salesOrderIdsContainingItem);
    return filterByStatus(next, statusFilter);
  }, [
    rowsWithNames,
    searchQuery,
    statusFilter,
    customerFilterId,
    warehouseFilterId,
    salesOrderIdsContainingItem,
  ]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter =
    statusFilter !== "all" ||
    searchQuery.trim() !== "" ||
    customerFilterId != null ||
    warehouseFilterId != null ||
    itemFilterId != null;

  const customerFilterLabel = useMemo((): string => {
    if (customerFilterId == null) return "";
    const c = customerRepository.getById(customerFilterId);
    if (c) return c.name || c.code || customerFilterId;
    return customerFilterId;
  }, [customerFilterId]);

  const clearCustomerFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("customerId");
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

  const itemFilterLabel = useMemo((): string => {
    if (itemFilterId == null) return "";
    const it = itemRepository.getById(itemFilterId);
    if (it) {
      const code = it.code?.trim() ?? "";
      const name = it.name?.trim() ?? "";
      if (code && name) return `${code} — ${name}`;
      return code || name || itemFilterId;
    }
    return itemFilterId;
  }, [itemFilterId]);

  const getExportRowsCurrentView = useCallback((): SalesOrdersExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromSO(filteredRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromSO(rows);
  }, [filteredRows]);

  const getExportRowsSelected = useCallback((): SalesOrdersExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromSO(rows);
  }, []);

  const runExportWithSaveAs = useCallback(
    async (defaultFilename: string, buildBuffer: () => Promise<ArrayBuffer>) => {
      try {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
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
    [],
  );

  const handleExportCurrentView = useCallback(() => {
    const rows = getExportRowsCurrentView();
    runExportWithSaveAs("sales-orders.xlsx", () => buildSalesOrdersListXlsxBuffer(rows));
  }, [getExportRowsCurrentView, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("sales-orders-selected.xlsx", () => buildSalesOrdersListXlsxBuffer(rows));
  }, [getExportRowsSelected, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? "No sales orders match current search or filters"
    : "No sales orders yet";
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return "Create your first sales order to start sales workflow.";
    }
    if (
      customerFilterId != null &&
      warehouseFilterId == null &&
      itemFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return "No sales orders for this customer. Try clearing the customer filter.";
    }
    if (
      warehouseFilterId != null &&
      itemFilterId == null &&
      customerFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return "No sales orders for this warehouse. Try clearing the warehouse filter.";
    }
    if (
      itemFilterId != null &&
      warehouseFilterId == null &&
      customerFilterId == null &&
      statusFilter === "all" &&
      searchQuery.trim() === ""
    ) {
      return "No sales orders include this item on any line. Try clearing the item filter.";
    }
    return "Try changing the search, status filter, or URL filters (customer, warehouse, item).";
  }, [
    hasFilter,
    customerFilterId,
    warehouseFilterId,
    itemFilterId,
    statusFilter,
    searchQuery,
  ]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "confirmed", label: "Confirmed" },
    { value: "closed", label: "Closed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "number",
        headerName: "Number",
        width: 150,
      },
      {
        field: "date",
        headerName: "Date",
        width: 140,
        valueFormatter: (params) => normalizeDateForSO(params.value),
      },
      {
        field: "customerName",
        headerName: "Customer",
        minWidth: 180,
      },
      {
        field: "warehouseName",
        headerName: "Warehouse",
        minWidth: 160,
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        cellRenderer: StatusCellRenderer,
      },
    ],
    [],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label="Back to Dashboard" />
          <ButtonGroup className="list-page__filter-group" aria-label="Filter by status">
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
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label="Search sales orders"
            resultCount={filteredRows.length}
          />
          <div className="flex flex-row flex-wrap items-center gap-2 shrink-0 ml-auto justify-end">
            {warehouseFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label="Warehouse filter active"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">Warehouse</span>
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
                  Clear
                </Button>
              </div>
            )}
            {itemFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,20rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label="Item filter active"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">Item</span>
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
                  Clear
                </Button>
              </div>
            )}
            {customerFilterId != null && (
              <div
                className="flex h-8 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                role="status"
                aria-label="Customer filter active"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">Customer</span>
                <span
                  className="truncate font-medium text-foreground/90 min-w-0"
                  title={customerFilterLabel}
                >
                  {customerFilterLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={clearCustomerFilter}
                >
                  Clear
                </Button>
              </div>
            )}
            {exportSuccess && (
              <div className="h-8 w-max flex items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm shrink-0">
                <span className="text-muted-foreground text-xs">Export completed:</span>
                <span className="font-medium text-xs truncate max-w-[12rem]" title={exportSuccess.filename}>{exportSuccess.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Open file"
                  aria-label="Open file"
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
                  title="Open folder"
                  aria-label="Open folder"
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
                  title="Dismiss"
                  aria-label="Dismiss"
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
                Export
              </Button>
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-l-none border-0 shadow-none"
                    aria-label="Export options"
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
                      title={exportSelectedDisabled ? "Select one or more rows in the grid first." : undefined}
                      onClick={() => {
                        setExportOpen(false);
                        if (!exportSelectedDisabled) handleExportSelected();
                      }}
                    >
                      Export selected rows
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
            onClick={() => navigate("/sales-orders/new")}
          >
            <span className="create-btn__plus">+</span> Create
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="sales-orders-grid">
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
              if (e.data) navigate(`/sales-orders/${e.data.id}`);
            }}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
