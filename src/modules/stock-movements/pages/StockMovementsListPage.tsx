/**
 * Stock Movements — Stage 4: Readability polish — Movement Type badge, wider columns, readable datetime.
 */
import { useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { stockMovementRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { receiptRepository } from "../../receipts/repository";
import { shipmentRepository } from "../../shipments/repository";
import type { StockMovement } from "../model";
import type { SourceDocumentType } from "../../../shared/domain";
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
import { ChevronDown, FileSpreadsheet, File, FolderOpen, X } from "lucide-react";
import { buildStockMovementsListXlsxBuffer, type StockMovementsExportRow } from "../stockMovementsListExport";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

type RowData = StockMovement & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  sourceDocumentLabel: string;
  sourceDocumentHref: string | null;
};

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt",
  shipment: "Shipment",
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function formatDateTime(isoString: string | null | undefined): string {
  if (isoString == null) return "";
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? String(isoString) : d.toLocaleString(undefined, DATE_TIME_FORMAT);
}

function MovementTypeCellRenderer(params: ICellRendererParams<RowData>) {
  const value = params.value as string | undefined;
  if (value == null) return null;
  const label = MOVEMENT_TYPE_LABEL[value] ?? value;
  return label;
}

function getSourceDocument(
  sourceDocumentType: SourceDocumentType,
  sourceDocumentId: string,
): { label: string; href: string | null } {
  if (sourceDocumentType === "receipt") {
    const doc = receiptRepository.getById(sourceDocumentId);
    return {
      label: doc ? `Receipt ${doc.number}` : `Receipt ${sourceDocumentId}`,
      href: `/receipts/${sourceDocumentId}`,
    };
  }
  if (sourceDocumentType === "shipment") {
    const doc = shipmentRepository.getById(sourceDocumentId);
    return {
      label: doc ? `Shipment ${doc.number}` : `Shipment ${sourceDocumentId}`,
      href: `/shipments/${sourceDocumentId}`,
    };
  }
  return { label: sourceDocumentId, href: null };
}

function SourceDocumentCellRenderer(params: ICellRendererParams<RowData>) {
  const data = params.data;
  if (!data) return null;
  const { sourceDocumentLabel, sourceDocumentHref } = data;
  if (sourceDocumentHref) {
    return (
      <Link
        to={sourceDocumentHref}
        className="list-table__link"
        onClick={(e) => e.stopPropagation()}
      >
        {sourceDocumentLabel}
      </Link>
    );
  }
  return <span>{sourceDocumentLabel}</span>;
}

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q) ||
      r.sourceDocumentLabel.toLowerCase().includes(q),
  );
}

function buildExportRowsFromMovements(rows: RowData[]): StockMovementsExportRow[] {
  return rows.map((r, idx) => ({
    no: idx + 1,
    dateTime: formatDateTime(r.datetime),
    movementType: MOVEMENT_TYPE_LABEL[r.movementType] ?? r.movementType,
    itemCode: r.itemCode,
    itemName: r.itemName,
    warehouse: r.warehouseName,
    qtyDelta:
      r.qtyDelta != null
        ? r.qtyDelta > 0
          ? `+${r.qtyDelta}`
          : String(r.qtyDelta)
        : "",
    sourceDocument: r.sourceDocumentLabel,
  }));
}

export function StockMovementsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [exportSuccess, setExportSuccess] = useState<{ path: string; filename: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridRef = useRef<AgGridReact<RowData> | null>(null);

  const onSelectionChanged = useCallback((e: SelectionChangedEvent<RowData>) => {
    setSelectedCount(e.api.getSelectedRows().length);
  }, []);

  const rowsWithNames = useMemo(() => {
    const list = stockMovementRepository.list();
    return list
      .map((m) => {
        const item = itemRepository.getById(m.itemId);
        const warehouse = warehouseRepository.getById(m.warehouseId);
        const { label: sourceDocumentLabel, href: sourceDocumentHref } =
          getSourceDocument(m.sourceDocumentType, m.sourceDocumentId);
        return {
          ...m,
          itemCode: item?.code ?? m.itemId,
          itemName: item?.name ?? m.itemId,
          warehouseName: warehouse?.name ?? m.warehouseId,
          sourceDocumentLabel,
          sourceDocumentHref,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      );
  }, []);

  const filteredRows = useMemo(
    () => filterBySearch(rowsWithNames, searchQuery),
    [rowsWithNames, searchQuery],
  );

  const isEmpty = filteredRows.length === 0;
  const hasFilter = searchQuery.trim() !== "";

  const getExportRowsCurrentView = useCallback((): StockMovementsExportRow[] => {
    const api = gridRef.current?.api;
    if (!api) return buildExportRowsFromMovements(filteredRows);
    const rows: RowData[] = [];
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (rowNode.data) rows.push(rowNode.data);
    });
    return buildExportRowsFromMovements(rows);
  }, [filteredRows]);

  const getExportRowsSelected = useCallback((): StockMovementsExportRow[] => {
    const api = gridRef.current?.api;
    const rows: RowData[] = api ? (api.getSelectedRows() as RowData[]) : [];
    return buildExportRowsFromMovements(rows);
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
    runExportWithSaveAs("stock-movements.xlsx", () => buildStockMovementsListXlsxBuffer(rows));
  }, [getExportRowsCurrentView, runExportWithSaveAs]);

  const handleExportSelected = useCallback(() => {
    const rows = getExportRowsSelected();
    if (rows.length === 0) return;
    runExportWithSaveAs("stock-movements-selected.xlsx", () => buildStockMovementsListXlsxBuffer(rows));
  }, [getExportRowsSelected, runExportWithSaveAs]);

  const exportSelectedDisabled = selectedCount === 0;

  const emptyTitle = hasFilter
    ? "No stock movements match current search"
    : "No stock movements yet";
  const emptyHint = hasFilter
    ? "Try changing the search."
    : "Movements will appear after posting receipts and shipments.";

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      agGridRowNumberColDef,
      {
        field: "datetime",
        headerName: "Date/Time",
        width: 200,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        field: "movementType",
        headerName: "Movement Type",
        width: 120,
        cellRenderer: MovementTypeCellRenderer,
      },
      {
        field: "itemCode",
        headerName: "Item Code",
        width: 120,
      },
      {
        field: "itemName",
        headerName: "Item Name",
        minWidth: 160,
      },
      {
        field: "warehouseName",
        headerName: "Warehouse",
        minWidth: 120,
      },
      {
        field: "qtyDelta",
        headerName: "Qty Delta",
        width: 110,
        valueFormatter: (params) =>
          params.value != null
            ? params.value > 0
              ? `+${params.value}`
              : String(params.value)
            : "",
      },
      {
        headerName: "Source Document",
        minWidth: 180,
        width: 180,
        valueGetter: (params) => params.data?.sourceDocumentLabel ?? "",
        cellRenderer: SourceDocumentCellRenderer,
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
          <ListPageSearch
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label="Search stock movements"
            resultCount={filteredRows.length}
          />
          <div className="flex flex-row items-center gap-2 shrink-0 ml-auto">
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
        <AgGridContainer themeClass="stock-movements-grid">
          <AgGridReact<RowData>
            ref={gridRef}
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
            selectionColumnDef={agGridSelectionColumnDef}
            getRowId={(params) => params.data.id}
            onSelectionChanged={onSelectionChanged}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
