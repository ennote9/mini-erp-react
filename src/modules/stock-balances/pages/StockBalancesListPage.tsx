import { useMemo, useState } from "react";
import { stockBalanceRepository } from "../repository";
import { itemRepository } from "../../items/repository";
import { warehouseRepository } from "../../warehouses/repository";
import type { StockBalance } from "../model";
import { ListPageLayout } from "../../../shared/ui/list/ListPageLayout";
import { EmptyState } from "../../../shared/ui/feedback/EmptyState";

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

  return (
    <ListPageLayout
      header={null}
      controls={
        <input
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
        <table className="list-table">
          <thead>
            <tr>
              <th className="list-table__cell list-table__cell--checkbox">
                <input type="checkbox" aria-label="Select all" disabled />
              </th>
              <th className="list-table__cell list-table__cell--code">
                Item Code
              </th>
              <th className="list-table__cell list-table__cell--name">
                Item Name
              </th>
              <th className="list-table__cell list-table__cell--warehouse">
                Warehouse
              </th>
              <th className="list-table__cell list-table__cell--number">
                Qty On Hand
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="list-table__row">
                <td
                  className="list-table__cell list-table__cell--checkbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.itemCode}`}
                  />
                </td>
                <td className="list-table__cell list-table__cell--code">
                  {row.itemCode}
                </td>
                <td className="list-table__cell list-table__cell--name">
                  {row.itemName}
                </td>
                <td className="list-table__cell list-table__cell--warehouse">
                  {row.warehouseName}
                </td>
                <td className="list-table__cell list-table__cell--number">
                  {row.qtyOnHand}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListPageLayout>
  );
}
