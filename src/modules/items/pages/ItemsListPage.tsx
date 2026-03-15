/**
 * Items list — AG Grid migration. Uses shared AgGridContainer and defaultColDef.
 * Preserves search, All/Active/Inactive filters, New button, row navigation, empty state.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { itemRepository } from "../repository";
import type { Item } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  items: Item[],
  activeFilter: ActiveFilter,
): Item[] {
  if (activeFilter === "active") return items.filter((x) => x.isActive);
  if (activeFilter === "inactive") return items.filter((x) => !x.isActive);
  return items;
}

function ActiveBadgeCellRenderer(params: ICellRendererParams<Item>) {
  const isActive = params.value as boolean;
  const label = isActive ? "Active" : "Inactive";
  return (
    <span
      className={
        "list-table__badge" +
        (isActive ? " list-table__badge--active" : " list-table__badge--inactive")
      }
    >
      {label}
    </span>
  );
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

  const columnDefs = useMemo<ColDef<Item>[]>(
    () => [
      {
        field: "code",
        headerName: "Code",
        width: 130,
      },
      {
        field: "name",
        headerName: "Name",
        minWidth: 160,
      },
      {
        field: "uom",
        headerName: "UOM",
        width: 90,
      },
      {
        field: "isActive",
        headerName: "Active",
        width: 100,
        cellRenderer: ActiveBadgeCellRenderer,
      },
    ],
    [],
  );

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
        <AgGridContainer themeClass="items-grid">
          <AgGridReact<Item>
            rowData={filteredItems}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/items/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
