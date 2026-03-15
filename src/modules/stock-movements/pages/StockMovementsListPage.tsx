/**
 * Stock Movements — MINIMAL AG Grid test.
 * Goal: see visible header row + 2 data rows. No repo, no custom renderers, fixed height.
 */
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";

type MinimalRow = { datetime: string; itemCode: string };

const MINIMAL_ROW_DATA: MinimalRow[] = [
  { datetime: "2026-03-15T10:00:00Z", itemCode: "ITEM-001" },
  { datetime: "2026-03-15T11:00:00Z", itemCode: "ITEM-002" },
];

const MINIMAL_COLUMN_DEFS: ColDef<MinimalRow>[] = [
  { field: "datetime", headerName: "Date/Time", sortable: true },
  { field: "itemCode", headerName: "Item Code", sortable: true },
];

export function StockMovementsListPage() {
  const columnDefs = useMemo(() => MINIMAL_COLUMN_DEFS, []);

  return (
    <ListPageLayout
      header={null}
      controls={
        <input
          type="search"
          className="list-page__search"
          placeholder="Search by item, warehouse or source document"
          aria-label="Search stock movements"
          readOnly
        />
      }
    >
      {/* Theme on wrapper so entire grid tree inherits dark variables. Fixed height only. */}
      <div
        className="ag-theme-quartz-dark stock-movements-grid"
        style={{
          width: "100%",
          height: "500px",
        }}
      >
        <AgGridReact<MinimalRow>
          rowData={MINIMAL_ROW_DATA}
          columnDefs={columnDefs}
        />
      </div>
    </ListPageLayout>
  );
}
