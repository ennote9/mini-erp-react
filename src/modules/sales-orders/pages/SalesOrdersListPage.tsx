import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesOrderRepository } from "../repository";
import { customerRepository } from "../../customers/repository";
import { warehouseRepository } from "../../warehouses/repository";
import { normalizeDateForSO } from "../dateUtils";
import type { SalesOrder } from "../model";
import type { PlanningDocumentStatus } from "../../../shared/domain";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { StatusBadge } from "../../../shared/ui/feedback/StatusBadge";

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

export function SalesOrdersListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    const bySearch = filterBySearch(rowsWithNames, searchQuery);
    return filterByStatus(bySearch, statusFilter);
  }, [rowsWithNames, searchQuery, statusFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = statusFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No sales orders match current search or filters"
    : "No sales orders yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Create your first sales order to start sales workflow.";

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
          onClick={() => navigate("/sales-orders/new")}
        >
          New
        </button>
      }
      controls={
        <>
          <input
            type="search"
            className="list-page__search"
            placeholder="Search by number or customer"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search sales orders"
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
              <th className="list-table__cell list-table__cell--customer">
                Customer
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
                onClick={() => navigate(`/sales-orders/${row.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/sales-orders/${row.id}`);
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
                  {normalizeDateForSO(row.date)}
                </td>
                <td className="list-table__cell list-table__cell--customer">
                  {row.customerName}
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
