import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { warehouseRepository } from "../repository";
import type { Warehouse } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  list: Warehouse[],
  activeFilter: ActiveFilter,
): Warehouse[] {
  if (activeFilter === "active") return list.filter((x) => x.isActive);
  if (activeFilter === "inactive") return list.filter((x) => !x.isActive);
  return list;
}

export function WarehousesListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filteredRows = useMemo(() => {
    const searched = warehouseRepository.search(searchQuery);
    return applyActiveFilter(searched, activeFilter);
  }, [searchQuery, activeFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = activeFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No warehouses match current search or filters"
    : "No warehouses yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Create your first warehouse to organize inventory.";

  return (
    <ListPageLayout
      header={
        <button
          type="button"
          className="list-page__primary-action"
          onClick={() => navigate("/warehouses/new")}
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
            aria-label="Search warehouses"
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
                onClick={() => navigate(`/warehouses/${row.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/warehouses/${row.id}`);
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
