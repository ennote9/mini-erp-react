/**
 * Read-only contributors for Stock Balances row drill-down.
 * Mirrors the same rules as stockBalancesOperationalMetrics (outgoing/incoming)
 * and active reservations for warehouse + item.
 */

import { stockReservationRepository } from "../modules/stock-reservations/repository";
import { salesOrderRepository } from "../modules/sales-orders/repository";
import { purchaseOrderRepository } from "../modules/purchase-orders/repository";
import {
  computeSalesOrderFulfillment,
  computePurchaseOrderFulfillment,
} from "./planningFulfillment";
import { normalizeTrim } from "./validation";
import type { PlanningDocumentStatus } from "./domain";

export type StockBalanceReservationContributor = {
  reservationId: string;
  salesOrderId: string;
  salesOrderNumber: string;
  salesOrderStatus: PlanningDocumentStatus;
  salesOrderLineId: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
};

/** Active reservations (qty > 0) for warehouse + item; sums match Reserved column. */
export function listReservationContributorsForWarehouseItem(
  warehouseId: string,
  itemId: string,
): StockBalanceReservationContributor[] {
  const wh = normalizeTrim(warehouseId);
  const it = normalizeTrim(itemId);
  const rows = stockReservationRepository
    .list()
    .filter(
      (r) =>
        r.status === "active" &&
        normalizeTrim(r.warehouseId) === wh &&
        normalizeTrim(r.itemId) === it &&
        r.qty > 0,
    );
  const mapped = rows.map((r) => {
    const so = salesOrderRepository.getById(r.salesOrderId);
    return {
      reservationId: r.id,
      salesOrderId: r.salesOrderId,
      salesOrderNumber: so?.number ?? r.salesOrderId,
      salesOrderStatus: (so?.status ?? "draft") as PlanningDocumentStatus,
      salesOrderLineId: r.salesOrderLineId,
      qty: r.qty,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
  mapped.sort((a, b) =>
    a.salesOrderNumber.localeCompare(b.salesOrderNumber, undefined, { numeric: true }),
  );
  return mapped;
}

export type StockBalanceOutgoingContributor = {
  salesOrderId: string;
  salesOrderNumber: string;
  salesOrderStatus: PlanningDocumentStatus;
  lineId: string;
  orderedQty: number;
  shippedQty: number;
  remainingCounted: number;
  lineReservedQty: number;
};

/**
 * Per SO line for confirmed SO + matching warehouse + itemId, same remaining as Outgoing column
 * (max(0, fulfillment line remainingQty)).
 */
export function listOutgoingContributorsForWarehouseItem(
  warehouseId: string,
  itemId: string,
): StockBalanceOutgoingContributor[] {
  const wh = normalizeTrim(warehouseId);
  const it = normalizeTrim(itemId);
  const out: StockBalanceOutgoingContributor[] = [];

  for (const so of salesOrderRepository.list()) {
    if (so.status !== "confirmed") continue;
    if (normalizeTrim(so.warehouseId) !== wh) continue;

    const fulfillment = computeSalesOrderFulfillment(so.id);
    const byLineId = new Map(fulfillment.lines.map((l) => [l.lineId, l]));

    for (const line of salesOrderRepository.listLines(so.id)) {
      if (normalizeTrim(line.itemId) !== it) continue;
      const fl = byLineId.get(line.id);
      if (!fl) continue;
      const remainingCounted = Math.max(0, fl.remainingQty);
      if (remainingCounted <= 0) continue;

      const lineReservedQty = stockReservationRepository.getActiveQtyForSalesOrderLine(
        so.id,
        line.id,
      );

      out.push({
        salesOrderId: so.id,
        salesOrderNumber: so.number,
        salesOrderStatus: so.status,
        lineId: line.id,
        orderedQty: fl.orderedQty,
        shippedQty: fl.shippedQty,
        remainingCounted,
        lineReservedQty,
      });
    }
  }

  out.sort((a, b) =>
    a.salesOrderNumber.localeCompare(b.salesOrderNumber, undefined, { numeric: true }),
  );
  return out;
}

export type StockBalanceIncomingContributor = {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  purchaseOrderStatus: PlanningDocumentStatus;
  lineId: string;
  orderedQty: number;
  receivedQty: number;
  remainingCounted: number;
};

/** Per PO line for confirmed PO + matching warehouse + itemId (same as Incoming column). */
export function listIncomingContributorsForWarehouseItem(
  warehouseId: string,
  itemId: string,
): StockBalanceIncomingContributor[] {
  const wh = normalizeTrim(warehouseId);
  const it = normalizeTrim(itemId);
  const out: StockBalanceIncomingContributor[] = [];

  for (const po of purchaseOrderRepository.list()) {
    if (po.status !== "confirmed") continue;
    if (normalizeTrim(po.warehouseId) !== wh) continue;

    const fulfillment = computePurchaseOrderFulfillment(po.id);
    const byLineId = new Map(fulfillment.lines.map((l) => [l.lineId, l]));

    for (const line of purchaseOrderRepository.listLines(po.id)) {
      if (normalizeTrim(line.itemId) !== it) continue;
      const fl = byLineId.get(line.id);
      if (!fl) continue;
      const remainingCounted = Math.max(0, fl.remainingQty);
      if (remainingCounted <= 0) continue;

      out.push({
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.number,
        purchaseOrderStatus: po.status,
        lineId: line.id,
        orderedQty: fl.orderedQty,
        receivedQty: fl.receivedQty,
        remainingCounted,
      });
    }
  }

  out.sort((a, b) =>
    a.purchaseOrderNumber.localeCompare(b.purchaseOrderNumber, undefined, { numeric: true }),
  );
  return out;
}
