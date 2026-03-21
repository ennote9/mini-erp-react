/**
 * Read-only operational metrics for Stock Balances list: reserved, available,
 * outgoing (SO remaining to ship), incoming (PO remaining to receive).
 */

import { salesOrderRepository } from "../modules/sales-orders/repository";
import { purchaseOrderRepository } from "../modules/purchase-orders/repository";
import { stockReservationRepository } from "../modules/stock-reservations/repository";
import {
  computeSalesOrderFulfillment,
  computePurchaseOrderFulfillment,
} from "./planningFulfillment";
import { normalizeTrim } from "./validation";

export function warehouseItemKey(warehouseId: string, itemId: string): string {
  return `${normalizeTrim(warehouseId)}\t${normalizeTrim(itemId)}`;
}

/**
 * Uncovered outgoing demand vs available free stock (read-only, not persisted).
 * max(0, outgoing - available); 0 when outgoing <= available.
 */
export function computeStockDeficit(availableQty: number, outgoingQty: number): number {
  return Math.max(0, outgoingQty - availableQty);
}

/**
 * Per warehouse+item: sum of max(0, remainingQty) from each line of
 * computeSalesOrderFulfillment, for sales orders with status **confirmed** only.
 * Posted shipments reduce remaining; draft / cancelled / closed SOs are excluded.
 */
export function buildOutgoingRemainingByWarehouseItem(): Map<string, number> {
  const out = new Map<string, number>();
  for (const so of salesOrderRepository.list()) {
    if (so.status !== "confirmed") continue;
    const wh = normalizeTrim(so.warehouseId);
    if (wh === "") continue;
    const f = computeSalesOrderFulfillment(so.id);
    for (const line of f.lines) {
      const rem = Math.max(0, line.remainingQty);
      if (rem <= 0) continue;
      const k = warehouseItemKey(wh, line.itemId);
      out.set(k, (out.get(k) ?? 0) + rem);
    }
  }
  return out;
}

/**
 * Per warehouse+item: sum of max(0, remainingQty) from each line of
 * computePurchaseOrderFulfillment, for purchase orders with status **confirmed** only.
 * Posted receipts reduce remaining; draft / cancelled / closed POs are excluded.
 */
export function buildIncomingRemainingByWarehouseItem(): Map<string, number> {
  const out = new Map<string, number>();
  for (const po of purchaseOrderRepository.list()) {
    if (po.status !== "confirmed") continue;
    const wh = normalizeTrim(po.warehouseId);
    if (wh === "") continue;
    const f = computePurchaseOrderFulfillment(po.id);
    for (const line of f.lines) {
      const rem = Math.max(0, line.remainingQty);
      if (rem <= 0) continue;
      const k = warehouseItemKey(wh, line.itemId);
      out.set(k, (out.get(k) ?? 0) + rem);
    }
  }
  return out;
}

export type StockBalanceOperationalFields = {
  /** Physical on-hand (from balance row). */
  totalQty: number;
  /** Active reservations only (same warehouse + item). */
  reservedQty: number;
  /** totalQty - reservedQty */
  availableQty: number;
  /** Sum of SO line remainings (confirmed SOs, matching fulfillment logic). */
  outgoingQty: number;
  /** Sum of PO line remainings (confirmed POs, matching fulfillment logic). */
  incomingQty: number;
  /** max(0, outgoingQty - availableQty) */
  deficitQty: number;
};

export function computeOperationalFieldsForBalance(
  balance: { itemId: string; warehouseId: string; qtyOnHand: number },
  outgoingByWhItem: Map<string, number>,
  incomingByWhItem: Map<string, number>,
): StockBalanceOperationalFields {
  const totalQty = balance.qtyOnHand;
  const reservedQty = stockReservationRepository.sumActiveQtyForWarehouseItem(
    balance.warehouseId,
    balance.itemId,
  );
  const k = warehouseItemKey(balance.warehouseId, balance.itemId);
  const availableQty = totalQty - reservedQty;
  const outgoingQty = outgoingByWhItem.get(k) ?? 0;
  return {
    totalQty,
    reservedQty,
    availableQty,
    outgoingQty,
    incomingQty: incomingByWhItem.get(k) ?? 0,
    deficitQty: computeStockDeficit(availableQty, outgoingQty),
  };
}
