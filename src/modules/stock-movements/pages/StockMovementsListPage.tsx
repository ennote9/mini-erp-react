/**
 * Stock Movements — Stage 2: real repository data, simple text columns, search, empty state.
 * No custom renderers (badge/link) yet. No Movement Type or Source Document columns yet.
 */
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { stockMovementRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { receiptRepository } from "../../receipts/repository";
import { shipmentRepository } from "../../shipments/repository";
import type { StockMovement } from "../model";
import type { SourceDocumentType } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";

type RowData = StockMovement & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  sourceDocumentLabel: string;
};

function getSourceDocumentLabel(
  sourceDocumentType: SourceDocumentType,
  sourceDocumentId: string,
): string {
  if (sourceDocumentType === "receipt") {
    const doc = receiptRepository.getById(sourceDocumentId);
    return doc ? `Receipt ${doc.number}` : `Receipt ${sourceDocumentId}`;
  }
  if (sourceDocumentType === "shipment") {
    const doc = shipmentRepository.getById(sourceDocumentId);
    return doc ? `Shipment ${doc.number}` : `Shipment ${sourceDocumentId}`;
  }
  return sourceDocumentId;
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

export function StockMovementsListPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const rowsWithNames = useMemo(() => {
    const list = stockMovementRepository.list();
    return list
      .map((m) => {
        const item = itemRepository.getById(m.itemId);
        const warehouse = warehouseRepository.getById(m.warehouseId);
        const sourceDocumentLabel = getSourceDocumentLabel(
          m.sourceDocumentType,
          m.sourceDocumentId,
        );
        return {
          ...m,
          itemCode: item?.code ?? m.itemId,
          itemName: item?.name ?? m.itemId,
          warehouseName: warehouse?.name ?? m.warehouseId,
          sourceDocumentLabel,
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

  const emptyTitle = hasFilter
    ? "No stock movements match current search"
    : "No stock movements yet";
  const emptyHint = hasFilter
    ? "Try changing the search."
    : "Movements will appear after posting receipts and shipments.";

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      {
        field: "datetime",
        headerName: "Date/Time",
        width: 180,
        sortable: true,
        resizable: true,
      },
      {
        field: "itemCode",
        headerName: "Item Code",
        width: 120,
        sortable: true,
        resizable: true,
      },
      {
        field: "itemName",
        headerName: "Item Name",
        minWidth: 160,
        sortable: true,
        resizable: true,
      },
      {
        field: "warehouseName",
        headerName: "Warehouse",
        minWidth: 120,
        sortable: true,
        resizable: true,
      },
      {
        field: "qtyDelta",
        headerName: "Qty Delta",
        width: 110,
        sortable: true,
        resizable: true,
        valueFormatter: (params) =>
          params.value != null
            ? params.value > 0
              ? `+${params.value}`
              : String(params.value)
            : "",
      },
    ],
    [],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <input
          type="search"
          className="list-page__search"
          placeholder="Search by item, warehouse or source document"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search stock movements"
        />
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div
          className="ag-theme-quartz-dark stock-movements-grid"
          style={{
            width: "100%",
            height: "500px",
          }}
        >
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
          />
        </div>
      )}
    </ListPageLayout>
  );
}
