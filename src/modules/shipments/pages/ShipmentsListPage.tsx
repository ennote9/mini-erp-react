import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { shipmentRepository } from "../repository";
import { salesOrderRepository } from "../../sales-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { Shipment } from "../model";
import type { FactualDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";

type StatusFilter = "all" | FactualDocumentStatus;

type RowData = Shipment & {
  salesOrderNumber: string;
  warehouseName: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.number.toLowerCase().includes(q) ||
      r.salesOrderNumber.toLowerCase().includes(q),
  );
}

function filterByStatus(rows: RowData[], statusFilter: StatusFilter): RowData[] {
  if (statusFilter === "all") return rows;
  return rows.filter((r) => r.status === statusFilter);
}

function StatusCellRenderer(params: ICellRendererParams<RowData>) {
  const status = params.value as string | undefined;
  if (status == null) return null;
  return <StatusBadge status={status} />;
}

export function ShipmentsListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rowsWithNames = useMemo(() => {
    const list = shipmentRepository.list();
    return list.map((s) => {
      const so = salesOrderRepository.getById(s.salesOrderId);
      const warehouse = warehouseRepository.getById(s.warehouseId);
      return {
        ...s,
        salesOrderNumber: so?.number ?? s.salesOrderId,
        warehouseName: warehouse?.name ?? s.warehouseId,
      };
    });
  }, []);

  const filteredRows = useMemo(() => {
    const bySearch = filterBySearch(rowsWithNames, searchQuery);
    return filterByStatus(bySearch, statusFilter);
  }, [rowsWithNames, searchQuery, statusFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = statusFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No shipments match current search or filters"
    : "No shipments yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Shipments are created from confirmed sales orders.";

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "posted", label: "Posted" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      {
        field: "number",
        headerName: "Number",
        width: 150,
      },
      {
        field: "date",
        headerName: "Date",
        width: 140,
      },
      {
        field: "salesOrderNumber",
        headerName: "Sales Order",
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
          <input
            type="search"
            className="list-page__search"
            placeholder="Search by number or sales order"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search shipments"
          />
          <div
            className="list-page__filters"
            role="group"
            aria-label="Filter by status"
          >
            {statusOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={
                  "list-page__filter-chip" +
                  (statusFilter === value ? " list-page__filter-chip--active" : "")
                }
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="shipments-grid">
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/shipments/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
