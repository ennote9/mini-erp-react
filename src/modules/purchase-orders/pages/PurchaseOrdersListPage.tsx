import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { purchaseOrderRepository } from "../repository";
import { supplierRepository } from "../../suppliers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { normalizeDateForPO } from "../dateUtils";
import type { PurchaseOrder } from "../model";
import type { PlanningDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";

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

  return (
    <ListPageLayout
      header={
        <button
          type="button"
          className="list-page__primary-action"
          onClick={() => navigate("/purchase-orders/new")}
        >
          New
        </button>
      }
      controls={
        <>
          <input
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
        <table className="list-table">
          <thead>
            <tr>
              <th className="list-table__cell list-table__cell--checkbox">
                <input type="checkbox" aria-label="Select all" disabled />
              </th>
              <th className="list-table__cell list-table__cell--number">
                Number
              </th>
              <th className="list-table__cell list-table__cell--date">Date</th>
              <th className="list-table__cell list-table__cell--supplier">
                Supplier
              </th>
              <th className="list-table__cell list-table__cell--warehouse">
                Warehouse
              </th>
              <th className="list-table__cell list-table__cell--status">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className="list-table__row list-table__row--clickable"
                onClick={() => navigate(`/purchase-orders/${row.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/purchase-orders/${row.id}`);
                  }
                }}
              >
                <td
                  className="list-table__cell list-table__cell--checkbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.number}`}
                  />
                </td>
                <td className="list-table__cell list-table__cell--number">
                  {row.number}
                </td>
                <td className="list-table__cell list-table__cell--date">
                  {normalizeDateForPO(row.date)}
                </td>
                <td className="list-table__cell list-table__cell--supplier">
                  {row.supplierName}
                </td>
                <td className="list-table__cell list-table__cell--warehouse">
                  {row.warehouseName}
                </td>
                <td className="list-table__cell list-table__cell--status">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListPageLayout>
  );
}
