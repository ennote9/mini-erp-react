import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { itemRepository } from "../repository";
import type { Item } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  items: Item[],
  activeFilter: ActiveFilter,
): Item[] {
  if (activeFilter === "active") return items.filter((x) => x.isActive);
  if (activeFilter === "inactive") return items.filter((x) => !x.isActive);
  return items;
}

export function ItemsListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filteredItems = useMemo(() => {
    const searched = itemRepository.search(searchQuery);
    return applyActiveFilter(searched, activeFilter);
  }, [searchQuery, activeFilter]);

  const isEmpty = filteredItems.length === 0;
  const hasActiveFilter = activeFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasActiveFilter
    ? "No items match current search or filters"
    : "No items yet";
  const emptyHint = hasActiveFilter
    ? "Try changing the search or filter."
    : "Create your first item to start working with inventory.";

  return (
    <ListPageLayout
      header={
        <button
          type="button"
          className="list-page__primary-action"
          onClick={() => navigate("/items/new")}
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
            aria-label="Search items"
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
              <th className="list-table__cell list-table__cell--uom">UOM</th>
              <th className="list-table__cell list-table__cell--active">
                Active
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((row) => (
              <tr
                key={row.id}
                className="list-table__row list-table__row--clickable"
                onClick={() => navigate(`/items/${row.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/items/${row.id}`);
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
                <td className="list-table__cell list-table__cell--uom">
                  {row.uom}
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
