/**
 * Suppliers list — AG Grid migration. Uses shared AgGridContainer and defaultColDef.
 * Preserves search, All/Active/Inactive filters, New button, row navigation, empty state.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { supplierRepository } from "../repository";
import type { Supplier } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  list: Supplier[],
  activeFilter: ActiveFilter,
): Supplier[] {
  if (activeFilter === "active") return list.filter((x) => x.isActive);
  if (activeFilter === "inactive") return list.filter((x) => !x.isActive);
  return list;
}

function ActiveBadgeCellRenderer(params: ICellRendererParams<Supplier>) {
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

  const columnDefs = useMemo<ColDef<Supplier>[]>(
    () => [
      {
        field: "code",
        headerName: "Code",
        width: 140,
      },
      {
        field: "name",
        headerName: "Name",
        minWidth: 180,
      },
      {
        field: "phone",
        headerName: "Phone",
        width: 150,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        field: "email",
        headerName: "Email",
        minWidth: 180,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        field: "isActive",
        headerName: "Active",
        width: 110,
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
        <AgGridContainer themeClass="suppliers-grid">
          <AgGridReact<Supplier>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/suppliers/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
