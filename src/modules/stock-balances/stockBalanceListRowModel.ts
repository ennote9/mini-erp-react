import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { stockBalanceRepository } from "./repository";
import type { StockBalance } from "./model";
import {
  buildOutgoingRemainingByWarehouseItem,
  buildIncomingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
  type StockBalanceCoverageStatus,
} from "@/shared/stockBalancesOperationalMetrics";

/**
 * Enriched row for the Stock Balances list: repository balance + resolved labels and operational metrics.
 */
export type StockBalanceListRow = StockBalance & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
  deficitQty: number;
  netShortageQty: number;
  coverageStatus: StockBalanceCoverageStatus;
};

export function buildStockBalanceListRows(): StockBalanceListRow[] {
  const outgoing = buildOutgoingRemainingByWarehouseItem();
  const incoming = buildIncomingRemainingByWarehouseItem();
  const list = stockBalanceRepository.list();
  return list.map((b) => {
    const item = itemRepository.getById(b.itemId);
    const warehouse = warehouseRepository.getById(b.warehouseId);
    const op = computeOperationalFieldsForBalance(b, outgoing, incoming);
    return {
      ...b,
      itemCode: item?.code ?? b.itemId,
      itemName: item?.name ?? b.itemId,
      warehouseName: warehouse?.name ?? b.warehouseId,
      reservedQty: op.reservedQty,
      availableQty: op.availableQty,
      outgoingQty: op.outgoingQty,
      incomingQty: op.incomingQty,
      deficitQty: op.deficitQty,
      netShortageQty: op.netShortageQty,
      coverageStatus: op.coverageStatus,
    };
  });
}
