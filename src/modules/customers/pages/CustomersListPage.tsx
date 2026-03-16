import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { customerRepository } from "../repository";
import type { Customer } from "../model";
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
  list: Customer[],
  activeFilter: ActiveFilter,
): Customer[] {
  if (activeFilter === "active") return list.filter((x) => x.isActive);
  if (activeFilter === "inactive") return list.filter((x) => !x.isActive);
  return list;
}

function ActiveStatusCellRenderer(params: ICellRendererParams<Customer>) {
  const isActive = params.value as boolean;
  const label = isActive ? "Active" : "Inactive";
  return (
    <span className={isActive ? "status-plain-text status-plain-text--active" : "status-plain-text status-plain-text--inactive"}>
      {label}
    </span>
  );
}

export function CustomersListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filteredRows = useMemo(() => {
    const searched = customerRepository.search(searchQuery);
    return applyActiveFilter(searched, activeFilter);
  }, [searchQuery, activeFilter]);

  const isEmpty = filteredRows.length === 0;
  const hasFilter = activeFilter !== "all" || searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No customers match current search or filters"
    : "No customers yet";
  const emptyHint = hasFilter
    ? "Try changing the search or filter."
    : "Create your first customer to start sales workflow.";

  const columnDefs = useMemo<ColDef<Customer>[]>(
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
        field: "contactPerson",
        headerName: "Contact person",
        width: 140,
        valueFormatter: (params) => params.value ?? "—",
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
        field: "city",
        headerName: "City",
        width: 120,
        valueFormatter: (params) => params.value ?? "—",
      },
      {
        field: "paymentTermsDays",
        headerName: "Payment terms",
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number"
            ? `${params.value} days`
            : "—",
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
            aria-label="Search customers"
            resultCount={filteredRows.length}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-md bg-white text-black hover:bg-gray-200"
            onClick={() => navigate("/customers/new")}
          >
            Create
          </Button>
        </>
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="customers-grid">
          <AgGridReact<Customer>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            rowSelection="multiple"
            getRowId={(params) => params.data.id}
            onRowClicked={(e) => e.data && navigate(`/customers/${e.data.id}`)}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
