/**
 * Planning ↔ factual fulfillment (MVP): PO↔Receipt, SO↔Shipment.
 * Only status "posted" on factual docs counts; draft / cancelled / reversed do not.
 * Matching by itemId only.
 */

import type { FactualDocumentStatus } from "./domain";
import { parseDocumentLineQty } from "./documentValidation";
import { purchaseOrderRepository } from "../modules/purchase-orders/repository";
import { salesOrderRepository } from "../modules/sales-orders/repository";
import { receiptRepository } from "../modules/receipts/repository";
import { shipmentRepository } from "../modules/shipments/repository";

/** Factual lines count toward ordered/shipped totals only when posted. */
export function factualStatusCountsTowardFulfillment(
  status: FactualDocumentStatus,
): boolean {
  return status === "posted";
}

export type PlanningFulfillmentState = "not_started" | "partial" | "complete";

export type PoLineFulfillment = {
  lineId: string;
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  /** orderedQty - receivedQty; negative ⇒ over-received on this line */
  remainingQty: number;
};

export type PurchaseOrderFulfillment = {
  lines: PoLineFulfillment[];
  totalOrdered: number;
  totalReceived: number;
  totalRemaining: number;
  state: PlanningFulfillmentState;
  hasOverFulfillment: boolean;
  relatedReceiptCount: number;
  postedReceiptCount: number;
};

export type SoLineFulfillment = {
  lineId: string;
  itemId: string;
  orderedQty: number;
  shippedQty: number;
  remainingQty: number;
};

export type SalesOrderFulfillment = {
  lines: SoLineFulfillment[];
  totalOrdered: number;
  totalShipped: number;
  totalRemaining: number;
  state: PlanningFulfillmentState;
  hasOverFulfillment: boolean;
  relatedShipmentCount: number;
  postedShipmentCount: number;
};

function qtyOrZero(q: unknown): number {
  const n = typeof q === "number" && Number.isFinite(q) ? q : parseDocumentLineQty(q);
  return n ?? 0;
}

/** Sum receipt line qty per item for a PO; optional exclude one receipt (e.g. draft being posted). */
export function aggregateReceivedQtyByItemForPurchaseOrder(
  purchaseOrderId: string,
  excludeReceiptId?: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of receiptRepository.list()) {
    if (r.purchaseOrderId !== purchaseOrderId) continue;
    if (!factualStatusCountsTowardFulfillment(r.status)) continue;
    if (excludeReceiptId != null && r.id === excludeReceiptId) continue;
    for (const line of receiptRepository.listLines(r.id)) {
      const q = qtyOrZero(line.qty);
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + q);
    }
  }
  return map;
}

export function getPurchaseOrderOrderedQtyByItemId(purchaseOrderId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const pl of purchaseOrderRepository.listLines(purchaseOrderId)) {
    const q = qtyOrZero(pl.qty);
    map.set(pl.itemId, (map.get(pl.itemId) ?? 0) + q);
  }
  return map;
}

export function computePurchaseOrderFulfillment(
  purchaseOrderId: string,
): PurchaseOrderFulfillment {
  const poLines = purchaseOrderRepository.listLines(purchaseOrderId);
  const receivedByItem = aggregateReceivedQtyByItemForPurchaseOrder(purchaseOrderId);

  const lines: PoLineFulfillment[] = [];
  let totalOrdered = 0;
  let totalReceived = 0;

  for (const pl of poLines) {
    const orderedQty = qtyOrZero(pl.qty);
    const receivedQty = receivedByItem.get(pl.itemId) ?? 0;
    const remainingQty = orderedQty - receivedQty;
    totalOrdered += orderedQty;
    totalReceived += receivedQty;
    lines.push({
      lineId: pl.id,
      itemId: pl.itemId,
      orderedQty,
      receivedQty,
      remainingQty,
    });
  }

  const totalRemaining = totalOrdered - totalReceived;
  const hasOverFulfillment = lines.some((l) => l.remainingQty < 0);

  let state: PlanningFulfillmentState;
  if (poLines.length === 0) {
    state = "not_started";
  } else if (lines.every((l) => l.receivedQty <= 0)) {
    state = "not_started";
  } else if (lines.every((l) => l.receivedQty >= l.orderedQty && l.orderedQty > 0)) {
    state = "complete";
  } else {
    state = "partial";
  }

  const relatedReceipts = receiptRepository
    .list()
    .filter((r) => r.purchaseOrderId === purchaseOrderId);
  const relatedReceiptCount = relatedReceipts.length;
  const postedReceiptCount = relatedReceipts.filter((r) =>
    factualStatusCountsTowardFulfillment(r.status),
  ).length;

  return {
    lines,
    totalOrdered,
    totalReceived,
    totalRemaining,
    state,
    hasOverFulfillment,
    relatedReceiptCount,
    postedReceiptCount,
  };
}

export function isPurchaseOrderReceiptFulfillmentComplete(purchaseOrderId: string): boolean {
  const f = computePurchaseOrderFulfillment(purchaseOrderId);
  return f.state === "complete";
}

export function aggregateShippedQtyByItemForSalesOrder(
  salesOrderId: string,
  excludeShipmentId?: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of shipmentRepository.list()) {
    if (s.salesOrderId !== salesOrderId) continue;
    if (!factualStatusCountsTowardFulfillment(s.status)) continue;
    if (excludeShipmentId != null && s.id === excludeShipmentId) continue;
    for (const line of shipmentRepository.listLines(s.id)) {
      const q = qtyOrZero(line.qty);
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + q);
    }
  }
  return map;
}

export function getSalesOrderOrderedQtyByItemId(salesOrderId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const sl of salesOrderRepository.listLines(salesOrderId)) {
    const q = qtyOrZero(sl.qty);
    map.set(sl.itemId, (map.get(sl.itemId) ?? 0) + q);
  }
  return map;
}

export function computeSalesOrderFulfillment(salesOrderId: string): SalesOrderFulfillment {
  const soLines = salesOrderRepository.listLines(salesOrderId);
  const shippedByItem = aggregateShippedQtyByItemForSalesOrder(salesOrderId);

  const lines: SoLineFulfillment[] = [];
  let totalOrdered = 0;
  let totalShipped = 0;

  for (const sl of soLines) {
    const orderedQty = qtyOrZero(sl.qty);
    const shippedQty = shippedByItem.get(sl.itemId) ?? 0;
    const remainingQty = orderedQty - shippedQty;
    totalOrdered += orderedQty;
    totalShipped += shippedQty;
    lines.push({
      lineId: sl.id,
      itemId: sl.itemId,
      orderedQty,
      shippedQty,
      remainingQty,
    });
  }

  const totalRemaining = totalOrdered - totalShipped;
  const hasOverFulfillment = lines.some((l) => l.remainingQty < 0);

  let state: PlanningFulfillmentState;
  if (soLines.length === 0) {
    state = "not_started";
  } else if (lines.every((l) => l.shippedQty <= 0)) {
    state = "not_started";
  } else if (lines.every((l) => l.shippedQty >= l.orderedQty && l.orderedQty > 0)) {
    state = "complete";
  } else {
    state = "partial";
  }

  const relatedShipments = shipmentRepository
    .list()
    .filter((s) => s.salesOrderId === salesOrderId);
  const relatedShipmentCount = relatedShipments.length;
  const postedShipmentCount = relatedShipments.filter((s) =>
    factualStatusCountsTowardFulfillment(s.status),
  ).length;

  return {
    lines,
    totalOrdered,
    totalShipped,
    totalRemaining,
    state,
    hasOverFulfillment,
    relatedShipmentCount,
    postedShipmentCount,
  };
}

export function isSalesOrderShipmentFulfillmentComplete(salesOrderId: string): boolean {
  const f = computeSalesOrderFulfillment(salesOrderId);
  return f.state === "complete";
}

export function planningFulfillmentStateLabel(state: PlanningFulfillmentState): string {
  switch (state) {
    case "not_started":
      return "Not started";
    case "partial":
      return "Partial";
    case "complete":
      return "Complete";
    default:
      return state;
  }
}
