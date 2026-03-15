/**
 * Stock Balances list — AG Grid migration (same pattern as Stock Movements).
 * Repository-backed data, search, empty states, dark theme. Plain text columns only.
 */
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { stockBalanceRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { StockBalance } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";
import { AgGridContainer, agGridDefaultColDef } from "../../../shared/ui/ag-grid";
import { Input } from "@/components/ui/input";

type RowData = StockBalance & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
};

function filterBySearch(rows: RowData[], query: string): RowData[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.warehouseName.toLowerCase().includes(q),
  );
}

export function StockBalancesListPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const rowsWithNames = useMemo(() => {
    const list = stockBalanceRepository.list();
    return list.map((b) => {
      const item = itemRepository.getById(b.itemId);
      const warehouse = warehouseRepository.getById(b.warehouseId);
      return {
        ...b,
        itemCode: item?.code ?? b.itemId,
        itemName: item?.name ?? b.itemId,
        warehouseName: warehouse?.name ?? b.warehouseId,
      };
    });
  }, []);

  const filteredRows = useMemo(
    () => filterBySearch(rowsWithNames, searchQuery),
    [rowsWithNames, searchQuery],
  );

  const isEmpty = filteredRows.length === 0;
  const hasFilter = searchQuery.trim() !== "";

  const emptyTitle = hasFilter
    ? "No stock balances match current search"
    : "No stock balances yet";
  const emptyHint = hasFilter
    ? "Try changing the search."
    : "Balances will appear after posting receipts and shipments.";

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      {
        field: "itemCode",
        headerName: "Item Code",
        width: 130,
      },
      {
        field: "itemName",
        headerName: "Item Name",
        minWidth: 160,
      },
      {
        field: "warehouseName",
        headerName: "Warehouse",
        minWidth: 140,
      },
      {
        field: "qtyOnHand",
        headerName: "Qty On Hand",
        width: 120,
      },
    ],
    [],
  );

  return (
    <ListPageLayout
      header={null}
      controls={
        <Input
          type="search"
          className="list-page__search"
          placeholder="Search by item code, name or warehouse"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search stock balances"
        />
      }
    >
      {isEmpty ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <AgGridContainer themeClass="stock-balances-grid">
          <AgGridReact<RowData>
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={agGridDefaultColDef}
            getRowId={(params) => params.data.id}
          />
        </AgGridContainer>
      )}
    </ListPageLayout>
  );
}
