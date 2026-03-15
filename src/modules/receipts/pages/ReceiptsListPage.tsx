import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { receiptRepository } from "../repository";
import { purchaseOrderRepository } from "../../purchase-orders/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { Receipt } from "../model";
import type { FactualDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";

type StatusFilter = "all" | FactualDocumentStatus;

type RowData = Receipt & {
  purchaseOrderNumber: string;
  warehouseName: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.number.toLowerCase().includes(q) ||
      r.purchaseOrderNumber.toLowerCase().includes(q),
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

export function ReceiptsListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rowsWithNames = useMemo(() => {
    const list = receiptRepository.list();
    return list.map((r) => {
      const po = purchaseOrderRepository.getById(r.purchaseOrderId);
      const warehouse = warehouseRepository.getById(r.warehouseId);
      return {
        ...r,
        purchaseOrderNumber: po?.number ?? r.purchaseOrderId,
        warehouseName: warehouse?.name ?? r.warehouseId,
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
    ? "No receipts match current search or filters"
    : "No receipts yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Receipts are created from confirmed purchase orders.";

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
        field: "purchaseOrderNumber",
        headerName: "Purchase Order",
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
            placeholder="Search by number or purchase order"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search receipts"
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
        <AgGridContainer themeClass="receipts-grid">
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/receipts/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
