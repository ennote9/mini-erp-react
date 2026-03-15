import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
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
  sourceDocumentHref: string | null;
};

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt",
  shipment: "Shipment",
};

function getSourceDocumentLabel(
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

function MovementTypeCellRenderer(params: ICellRendererParams<RowData>) {
  const movementType = params.data?.movementType ?? "";
  const label = MOVEMENT_TYPE_LABEL[movementType] ?? movementType;
  return (
    <span
      className={`list-table__badge list-table__badge--status list-table__badge--${movementType}`}
    >
      {label}
    </span>
  );
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
  return <>{sourceDocumentLabel}</>;
}

export function StockMovementsListPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const rowsWithNames = useMemo(() => {
    const list = stockMovementRepository.list();
    return list
      .map((m) => {
        const item = itemRepository.getById(m.itemId);
        const warehouse = warehouseRepository.getById(m.warehouseId);
        const { label: sourceDocumentLabel, href: sourceDocumentHref } =
          getSourceDocumentLabel(m.sourceDocumentType, m.sourceDocumentId);
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

  const emptyTitle = hasFilter
    ? "No stock movements match current search"
    : "No stock movements yet";
  const emptyHint = hasFilter
    ? "Try changing the search."
    : "Movements will appear after posting receipts and shipments.";

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      {
        field: "id",
        headerName: "",
        checkboxSelection: true,
        headerCheckboxSelection: false,
        width: 52,
        resizable: false,
        sortable: false,
      },
      {
        field: "datetime",
        headerName: "Date/Time",
        width: 150,
        sortable: true,
        resizable: true,
      },
      {
        field: "movementType",
        headerName: "Movement Type",
        width: 120,
        sortable: true,
        resizable: true,
        cellRenderer: MovementTypeCellRenderer,
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
      {
        headerName: "Source Document",
        minWidth: 130,
        sortable: true,
        resizable: true,
        valueGetter: (params) => params.data?.sourceDocumentLabel ?? "",
        cellRenderer: SourceDocumentCellRenderer,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<RowData>>(
    () => ({
      sortable: true,
      resizable: true,
    }),
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
          className="list-page__grid-wrapper"
          style={{ width: "100%", height: "100%", minHeight: 450 }}
        >
          <AgGridReact<RowData>
            className="ag-theme-quartz-dark"
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection
            domLayout="normal"
            getRowId={(params) => params.data.id}
          />
        </div>
      )}
    </ListPageLayout>
  );
}
