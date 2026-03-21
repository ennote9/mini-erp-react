/**
 * Stock Balances list — AG Grid migration (same pattern as Stock Movements).
 * Repository-backed data, search, empty states, dark theme. Plain text columns only.
 */
import { Fragment, useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { RowClassParams, RowClickedEvent } from "ag-grid-community";
import { useSearchParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { stockBalanceRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { StockBalance } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridRowNumberColDef,
  agGridSelectionColumnDef,
} from "../../../shared/ui/ag-grid";
import { BackButton } from "../../../shared/ui/list/BackButton";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildStockBalancesListXlsxBuffer, type StockBalancesExportRow } from "../stockBalancesListExport";
import {
  buildOutgoingRemainingByWarehouseItem,
  buildIncomingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
  STOCK_BALANCE_COVERAGE_LABELS,
  type StockBalanceCoverageStatus,
} from "../../../shared/stockBalancesOperationalMetrics";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { StockBalanceRowDrillDown } from "../components/StockBalanceRowDrillDown";

type RowData = StockBalance & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
  deficitQty: number;
  netShortageQty: number;
  coverageStatus: StockBalanceCoverageStatus;
};

type StockBalanceQuickFilter =
  | "all"
  | "shortage"
  | "outgoing"
  | "incoming"
  | "avail_lte_zero"
  | "needs_replenishment"
  | "coverage_at_risk";

const QUICK_FILTER_OPTIONS: Array<{
  value: StockBalanceQuickFilter;
  label: string;
  /** Full phrase for aria-label / title */
  aria: string;
}> = [
  { value: "all", label: "All", aria: "Show all rows" },
  { value: "shortage", label: "Shortage", aria: "Show rows with deficit greater than zero" },
  { value: "outgoing", label: "Has outgoing", aria: "Show rows with outgoing demand" },
  { value: "incoming", label: "Has incoming", aria: "Show rows with incoming supply" },
  {
    value: "avail_lte_zero",
    label: "Avail ≤ 0",
    aria: "Show rows where available quantity is zero or negative",
  },
  {
    value: "needs_replenishment",
    label: "Need repl.",
    aria: "Show rows with net shortage greater than zero (uncovered demand after incoming)",
  },
  {
    value: "coverage_at_risk",
    label: "At risk",
    aria:
      "Show rows where outgoing exceeds available but expected incoming covers the gap (covered by incoming, net shortage zero)",
  },
];

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q) ||
      STOCK_BALANCE_COVERAGE_LABELS[r.coverageStatus].toLowerCase().includes(q),
  );
}

function filterByWarehouseId(rows: RowData[], warehouseId: string | null): RowData[] {
  if (warehouseId == null) return rows;
  return rows.filter((r) => r.warehouseId === warehouseId);
}

function filterByQuickFilter(rows: RowData[], f: StockBalanceQuickFilter): RowData[] {
  if (f === "all") return rows;
  if (f === "shortage") return rows.filter((r) => r.deficitQty > 0);
  if (f === "outgoing") return rows.filter((r) => r.outgoingQty > 0);
  if (f === "incoming") return rows.filter((r) => r.incomingQty > 0);
  if (f === "avail_lte_zero") return rows.filter((r) => r.availableQty <= 0);
  if (f === "needs_replenishment") return rows.filter((r) => r.netShortageQty > 0);
  if (f === "coverage_at_risk")
    return rows.filter(
      (r) =>
        r.outgoingQty > r.availableQty && r.incomingQty > 0 && r.netShortageQty === 0,
    );
  return rows;
}

function buildExportRowsFromBalances(rows: RowData[]): StockBalancesExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    itemCode: r.itemCode,
    itemName: r.itemName,
    warehouse: r.warehouseName,
    totalQty: r.qtyOnHand,
    reservedQty: r.reservedQty,
    availableQty: r.availableQty,
    outgoingQty: r.outgoingQty,
    incomingQty: r.incomingQty,
    deficitQty: r.deficitQty,
    netShortageQty: r.netShortageQty,
    coverage: STOCK_BALANCE_COVERAGE_LABELS[r.coverageStatus],
  }));
}

export function StockBalancesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const warehouseFilterId = useMemo(() => {
    const raw = searchParams.get("warehouseId");
    if (raw == null || raw === "") return null;
    const t = raw.trim();
    return t === "" ? null : t;
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<StockBalanceQuickFilter>("all");
  const [detailRow, setDetailRow] = useState<RowData | null>(null);
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const rowsWithNames = useMemo(() => {
    const outgoing = buildOutgoingRemainingByWarehouseItem();
    const incoming = buildIncomingRemainingByWarehouseItem();
    const list = stockBalanceRepository.list();
    return list.map((b) => {
      const item = itemRepository.getById(b.itemId);
      const warehouse = warehouseRepository.getById(b.warehouseId);
      const op = computeOperationalFieldsForBalance(b, outgoing, incoming);
      return {
        ...b,
        itemCode: item?.code ?? b.itemId,
        itemName: item?.name ?? b.itemId,
        warehouseName: warehouse?.name ?? b.warehouseId,
        reservedQty: op.reservedQty,
        availableQty: op.availableQty,
        outgoingQty: op.outgoingQty,
        incomingQty: op.incomingQty,
        deficitQty: op.deficitQty,
        netShortageQty: op.netShortageQty,
        coverageStatus: op.coverageStatus,
      };
    });
  }, []);

  const getRowClass = useCallback((params: RowClassParams<RowData>) => {
    const d = params.data;
    if (!d) return "";
    if (d.netShortageQty > 0) return "stock-balances-row--tight-availability";
    if (d.coverageStatus === "at_risk") return "stock-balances-row--at-risk";
    return "";
  }, []);

  /** Base slice after warehouse URL filter (counts and search use this). */
  const rowsAfterWarehouse = useMemo(
    () => filterByWarehouseId(rowsWithNames, warehouseFilterId),
    [rowsWithNames, warehouseFilterId],
  );

  const quickFilterCounts = useMemo((): Record<StockBalanceQuickFilter, number> => {
    let shortage = 0;
    let outgoing = 0;
    let incoming = 0;
    let availLteZero = 0;
    let needsRepl = 0;
    let atRisk = 0;
    for (const r of rowsAfterWarehouse) {
      if (r.deficitQty > 0) shortage++;
      if (r.outgoingQty > 0) outgoing++;
      if (r.incomingQty > 0) incoming++;
      if (r.availableQty <= 0) availLteZero++;
      if (r.netShortageQty > 0) needsRepl++;
      if (
        r.outgoingQty > r.availableQty &&
        r.incomingQty > 0 &&
        r.netShortageQty === 0
      )
        atRisk++;
    }
    return {
      all: rowsAfterWarehouse.length,
      shortage,
      outgoing,
      incoming,
      avail_lte_zero: availLteZero,
      needs_replenishment: needsRepl,
      coverage_at_risk: atRisk,
    };
  }, [rowsAfterWarehouse]);

  const filteredRows = useMemo(() => {
    const bySearch = filterBySearch(rowsAfterWarehouse, searchQuery);
    return filterByQuickFilter(bySearch, quickFilter);
  }, [rowsAfterWarehouse, searchQuery, quickFilter]);

  const isEmpty = filteredRows.length === 0;

  useEffect(() => {
    if (isEmpty) setDetailRow(null);
  }, [isEmpty]);

  const onRowClicked = useCallback((e: RowClickedEvent<RowData>) => {
    if (e.data) setDetailRow(e.data);
  }, []);

  const onDrillDownOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailRow(null);
  }, []);
  const hasFilter =
    searchQuery.trim() !== "" || warehouseFilterId != null || quickFilter !== "all";

  const warehouseFilterLabel = useMemo((): string => {
    if (warehouseFilterId == null) return "";
    const w = warehouseRepository.getById(warehouseFilterId);
    if (w) return w.name || w.code || warehouseFilterId;
    return warehouseFilterId;
  }, [warehouseFilterId]);

  const clearWarehouseFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("warehouseId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getExportRowsCurrentView = useCallback((): StockBalancesExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromBalances(filteredRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromBalances(rows);
  }, [filteredRows]);

  const getExportRowsSelected = useCallback((): StockBalancesExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromBalances(rows);
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
    runExportWithSaveAs("stock-balances.xlsx", () => buildStockBalancesListXlsxBuffer(rows));
  }, [getExportRowsCurrentView, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("stock-balances-selected.xlsx", () => buildStockBalancesListXlsxBuffer(rows));
  }, [getExportRowsSelected, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? "No stock balances match current search or filters"
    : "No stock balances yet";
  const emptyHint = useMemo(() => {
    if (!hasFilter) {
      return "Balances will appear after posting receipts and shipments.";
    }
    if (quickFilter !== "all" && searchQuery.trim() === "" && warehouseFilterId == null) {
      return "No rows match this quick filter. Try All or another filter.";
    }
    if (warehouseFilterId != null && searchQuery.trim() === "" && quickFilter === "all") {
      return "No stock balances for this warehouse. Try clearing the warehouse filter.";
    }
    return "Try changing the search, quick filter, or warehouse filter.";
  }, [hasFilter, warehouseFilterId, searchQuery, quickFilter]);

  const qtyCol = (
    field: keyof RowData,
    headerName: string,
    width: number,
  ): ColDef<RowData> => ({
    field,
    headerName,
    width,
    minWidth: width - 8,
    maxWidth: width + 24,
    sortable: true,
    type: "numericColumn",
    cellClass: "tabular-nums",
    valueFormatter: (p) =>
      typeof p.value === "number" && !Number.isNaN(p.value) ? String(p.value) : "—",
  });

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "itemCode",
        headerName: "Item Code",
        width: 118,
        minWidth: 100,
      },
      {
        field: "itemName",
        headerName: "Item Name",
        flex: 1,
        minWidth: 140,
      },
      {
        field: "warehouseName",
        headerName: "Warehouse",
        minWidth: 120,
        width: 140,
      },
      qtyCol("qtyOnHand", "Total quantity", 112),
      qtyCol("reservedQty", "Reserved", 96),
      qtyCol("availableQty", "Available", 100),
      qtyCol("deficitQty", "Deficit", 88),
      qtyCol("outgoingQty", "Outgoing", 96),
      qtyCol("incomingQty", "Incoming", 96),
      qtyCol("netShortageQty", "Net shortage", 104),
      {
        field: "coverageStatus",
        headerName: "Coverage",
        width: 102,
        minWidth: 92,
        maxWidth: 120,
        sortable: true,
        valueFormatter: (p) =>
          p.value != null
            ? STOCK_BALANCE_COVERAGE_LABELS[p.value as StockBalanceCoverageStatus] ?? String(p.value)
            : "—",
        cellClass: (p) =>
          p.data?.coverageStatus === "short"
            ? "font-medium"
            : p.data?.coverageStatus === "at_risk"
              ? "text-muted-foreground"
              : "text-muted-foreground/90",
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
          <ButtonGroup className="list-page__filter-group shrink-0" aria-label="Quick filters">
            {QUICK_FILTER_OPTIONS.map((opt, index) => (
              <Fragment key={opt.value}>
                {index > 0 && <ButtonGroupSeparator />}
                <Button
                  type="button"
                  variant={quickFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  className="px-2 text-xs gap-1"
                  title={opt.aria}
                  aria-pressed={quickFilter === opt.value}
                  onClick={() => setQuickFilter(opt.value)}
                >
                  <span>{opt.label}</span>
                  <span
                    className={
                      quickFilter === opt.value
                        ? "tabular-nums font-normal opacity-90"
                        : "tabular-nums text-muted-foreground font-normal"
                    }
                  >
                    ({quickFilterCounts[opt.value]})
                  </span>
                </Button>
              </Fragment>
            ))}
          </ButtonGroup>
          <ListPageSearch
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label="Search stock balances"
            resultCount={filteredRows.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
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
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-1.5">
            Click a row to open the source breakdown in a dialog (reservations, outgoing, incoming).
          </p>
          <AgGridContainer themeClass="stock-balances-grid">
            <AgGridReact<RowData>
              ref={gridRef}
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={agGridDefaultColDef}
              rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
              selectionColumnDef={agGridSelectionColumnDef}
              getRowId={(params) => params.data.id}
              getRowClass={getRowClass}
              onSelectionChanged={onSelectionChanged}
              onRowClicked={onRowClicked}
            />
          </AgGridContainer>
          {detailRow ? (
            <StockBalanceRowDrillDown
              key={detailRow.id}
              row={{
                itemId: detailRow.itemId,
                warehouseId: detailRow.warehouseId,
                itemCode: detailRow.itemCode,
                itemName: detailRow.itemName,
                warehouseName: detailRow.warehouseName,
                qtyOnHand: detailRow.qtyOnHand,
                reservedQty: detailRow.reservedQty,
                availableQty: detailRow.availableQty,
                outgoingQty: detailRow.outgoingQty,
                incomingQty: detailRow.incomingQty,
                deficitQty: detailRow.deficitQty,
                netShortageQty: detailRow.netShortageQty,
                coverageStatus: detailRow.coverageStatus,
              }}
              onOpenChange={onDrillDownOpenChange}
            />
          ) : null}
        </>
      )}
    </ListPageLayout>
  );
}
