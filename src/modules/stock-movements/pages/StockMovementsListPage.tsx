/**
 * Stock Movements — Stage 4: Readability polish — Movement Type badge, wider columns, readable datetime.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { stockMovementRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { receiptRepository } from "../../receipts/repository";
import { shipmentRepository } from "../../shipments/repository";
import type { StockMovement } from "../model";
import type { SourceDocumentType } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";

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
  const modifier = value === "receipt" || value === "shipment" ? value : "receipt";
  return (
    <span
      className={`list-table__badge list-table__badge--status list-table__badge--${modifier}`}
    >
      {label}
    </span>
  );
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

export function StockMovementsListPage() {
  const [searchQuery, setSearchQuery] = useState("");

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
        <AgGridContainer themeClass="stock-movements-grid">
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
