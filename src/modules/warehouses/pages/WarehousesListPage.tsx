import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { warehouseRepository } from "../repository";
import type { Warehouse } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import {
  AgGridContainer,
  agGridDefaultColDef,
  agGridRowNumberColDef,
  agGridCheckboxSelectionColDef,
} from "../../../shared/ui/ag-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActiveFilter = "all" | "active" | "inactive";

function applyActiveFilter(
  list: Warehouse[],
  activeFilter: ActiveFilter,
): Warehouse[] {
  if (activeFilter === "active") return list.filter((x) => x.isActive);
  if (activeFilter === "inactive") return list.filter((x) => !x.isActive);
  return list;
}

function ActiveStatusCellRenderer(params: ICellRendererParams<Warehouse>) {
  const isActive = params.value as boolean;
  const label = isActive ? "Active" : "Inactive";
  return (
    <span className={isActive ? "status-plain-text status-plain-text--active" : "status-plain-text status-plain-text--inactive"}>
      {label}
    </span>
  );
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

  const columnDefs = useMemo<ColDef<Warehouse>[]>(
    () => [
      agGridRowNumberColDef,
      agGridCheckboxSelectionColDef,
      {
        field: "code",
        headerName: "Code",
        width: 140,
      },
      {
        field: "name",
        headerName: "Name",
        minWidth: 180,
        flex: 1,
      },
      {
        field: "isActive",
        headerName: "Active",
        width: 110,
        cellRenderer: ActiveStatusCellRenderer,
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
          onClick={() => navigate("/warehouses/new")}
        >
          New
        </Button>
      }
      controls={
        <>
          <Input
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
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
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
              </Button>
            ))}
          </div>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="warehouses-grid">
          <AgGridReact<Warehouse>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection="multiple"
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/warehouses/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
