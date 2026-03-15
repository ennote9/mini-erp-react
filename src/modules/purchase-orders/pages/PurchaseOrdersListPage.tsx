import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { purchaseOrderRepository } from "../repository";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { normalizeDateForPO } from "../dateUtils";
import type { PurchaseOrder } from "../model";
import type { PlanningDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function StatusCellRenderer(params: ICellRendererParams<RowData>) {
  const status = params.value as string | undefined;
  if (status == null) return null;
  return <StatusBadge status={status} />;
}

export function PurchaseOrdersListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    const bySearch = filterBySearch(rowsWithNames, searchQuery);
    return filterByStatus(bySearch, statusFilter);
  }, [rowsWithNames, searchQuery, statusFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = statusFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No purchase orders match current search or filters"
    : "No purchase orders yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Create your first purchase order to start purchasing workflow.";

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "confirmed", label: "Confirmed" },
    { value: "closed", label: "Closed" },
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
        valueFormatter: (params) => normalizeDateForPO(params.value),
      },
      {
        field: "supplierName",
        headerName: "Supplier",
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
      header={
        <Button
          type="button"
          className="list-page__primary-action"
          onClick={() => navigate("/purchase-orders/new")}
        >
          New
        </Button>
      }
      controls={
        <>
          <Input
            type="search"
            className="list-page__search"
            placeholder="Search by number or supplier"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search purchase orders"
          />
          <div
            className="list-page__filters"
            role="group"
            aria-label="Filter by status"
          >
            {statusOptions.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                className={
                  "list-page__filter-chip" +
                  (statusFilter === value ? " list-page__filter-chip--active" : "")
                }
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="purchase-orders-grid">
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/purchase-orders/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
