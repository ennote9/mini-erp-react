import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supplierRepository } from "../repository";
import type { Supplier } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  list: Supplier[],
  activeFilter: ActiveFilter,
): Supplier[] {
  if (activeFilter === "active") return list.filter((x) => x.isActive);
  if (activeFilter === "inactive") return list.filter((x) => !x.isActive);
  return list;
}

export function SuppliersListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filteredRows = useMemo(() => {
    const searched = supplierRepository.search(searchQuery);
    return applyActiveFilter(searched, activeFilter);
  }, [searchQuery, activeFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = activeFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No suppliers match current search or filters"
    : "No suppliers yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Create your first supplier to start purchasing workflow.";

  return (
    <ListPageLayout
      header={
        <button
          type="button"
          className="list-page__primary-action"
          onClick={() => navigate("/suppliers/new")}
        >
          New
        </button>
      }
      controls={
        <>
          <input
            type="search"
            className="list-page__search"
            placeholder="Search by code or name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search suppliers"
          />
          <div
            className="list-page__filters"
            role="group"
            aria-label="Filter by status"
          >
            {(["all", "active", "inactive"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={
                  "list-page__filter-chip" +
                  (activeFilter === value ? " list-page__filter-chip--active" : "")
                }
                onClick={() => setActiveFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "active"
                    ? "Active"
                    : "Inactive"}
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
              <th className="list-table__cell list-table__cell--code">Code</th>
              <th className="list-table__cell list-table__cell--name">Name</th>
              <th className="list-table__cell list-table__cell--date">Phone</th>
              <th className="list-table__cell list-table__cell--supplier">Email</th>
              <th className="list-table__cell list-table__cell--active">
                Active
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className="list-table__row list-table__row--clickable"
                onClick={() => navigate(`/suppliers/${row.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/suppliers/${row.id}`);
                  }
                }}
              >
                <td
                  className="list-table__cell list-table__cell--checkbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input type="checkbox" aria-label={`Select ${row.code}`} />
                </td>
                <td className="list-table__cell list-table__cell--code">
                  {row.code}
                </td>
                <td className="list-table__cell list-table__cell--name">
                  {row.name}
                </td>
                <td className="list-table__cell list-table__cell--date">
                  {row.phone ?? "—"}
                </td>
                <td className="list-table__cell list-table__cell--supplier">
                  {row.email ?? "—"}
                </td>
                <td className="list-table__cell list-table__cell--active">
                  <span
                    className={
                      "list-table__badge" +
                      (row.isActive
                        ? " list-table__badge--active"
                        : " list-table__badge--inactive")
                    }
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListPageLayout>
  );
}
