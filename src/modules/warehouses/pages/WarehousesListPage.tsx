import React, { useMemo, useState } from "react";
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
import { BackButton } from "../../../shared/ui/list/BackButton";
import { ListPageSearch } from "../../../shared/ui/list/ListPageSearch";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";

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
        field: "warehouseType",
        headerName: "Type",
        width: 120,
      },
      {
        field: "city",
        headerName: "City",
        width: 140,
      },
      {
        field: "contactPerson",
        headerName: "Contact person",
        width: 150,
      },
      {
        field: "phone",
        headerName: "Phone",
        width: 140,
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
      header={null}
      controls={
        <>
          <BackButton to="/" aria-label="Back to Dashboard" />
          <ButtonGroup className="list-page__filter-group" aria-label="Filter by status">
            {(["all", "active", "inactive"] as const).map((value, index) => (
              <React.Fragment key={value}>
                {index > 0 && <ButtonGroupSeparator />}
                <Button
                  type="button"
                  variant={activeFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(value)}
                >
                  {value === "all"
                    ? "All"
                    : value === "active"
                      ? "Active"
                      : "Inactive"}
                </Button>
              </React.Fragment>
            ))}
          </ButtonGroup>
          <ListPageSearch
            placeholder="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label="Search warehouses"
            resultCount={filteredRows.length}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate("/warehouses/new")}
          >
            Create
          </Button>
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
