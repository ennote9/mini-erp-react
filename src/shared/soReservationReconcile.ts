/**
 * Deterministic sales-order reservation reconciliation: keeps active reservations
 * aligned with current SO header, lines, fulfillment remaining, and status.
 *
 * Does not create new reservations (use allocateStock). Increasing demand leaves
 * reservation unchanged until the user runs Allocate stock again.
 */

import { salesOrderRepository } from "../modules/sales-orders/repository";
import { stockReservationRepository } from "../modules/stock-reservations/repository";
import { computeSalesOrderFulfillment } from "./planningFulfillment";
import { normalizeTrim } from "./validation";
import { appendAuditEvent } from "./audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "./audit/eventLogTypes";

export type ReconcileSalesOrderReservationsReason =
  | "save_draft"
  | "confirm"
  | "allocate_stock"
  | "shipment_validation"
  | "sales_order_closed"
  | "shipment_reversal";

export type ReconcileSalesOrderReservationsResult = {
  changed: boolean;
  /** Active rows moved to released (orphan, warehouse/item mismatch, remaining≤0, or status sweep). */
  releasedRows: number;
  /** Lines where active qty was reduced to match remaining demand (no new reservation created). */
  shrunkLines: number;
};

function shouldEmitAuditByDefault(reason: ReconcileSalesOrderReservationsReason): boolean {
  return reason !== "shipment_validation";
}

/**
 * Single entry point: release invalid/stale actives, shrink when reserved > remaining.
 * Draft / cancelled / closed: release all active reservations for this SO.
 */
export function reconcileSalesOrderReservations(
  salesOrderId: string,
  options?: {
    reason?: ReconcileSalesOrderReservationsReason;
    /** Override default (off for shipment_validation). */
    emitAudit?: boolean;
  },
): ReconcileSalesOrderReservationsResult {
  const reason = options?.reason ?? "confirm";
  const emitAudit =
    options?.emitAudit ?? shouldEmitAuditByDefault(reason);

  const so = salesOrderRepository.getById(salesOrderId);
  if (!so) {
    return { changed: false, releasedRows: 0, shrunkLines: 0 };
  }

  const status = so.status;

  if (status === "draft" || status === "cancelled" || status === "closed") {
    const n = stockReservationRepository.releaseAllActiveForSalesOrder(salesOrderId);
    const changed = n > 0;
    if (changed && emitAudit) {
      appendAuditEvent({
        entityType: "sales_order",
        entityId: salesOrderId,
        eventType: "reservation_reconciled",
        actor: AUDIT_ACTOR_LOCAL_USER,
        payload: {
          documentNumber: so.number,
          reason,
          releasedRows: n,
          shrunkLines: 0,
          note:
            status === "draft"
              ? "draft_status_release_all"
              : status === "closed"
                ? "closed_status_release_all"
                : "cancelled_status_release_all",
        },
      });
    }
    return { changed, releasedRows: n, shrunkLines: 0 };
  }

  if (status !== "confirmed") {
    return { changed: false, releasedRows: 0, shrunkLines: 0 };
  }

  const wh = normalizeTrim(so.warehouseId);
  const dbLines = salesOrderRepository.listLines(salesOrderId);
  const lineById = new Map(dbLines.map((l) => [l.id, l]));
  const fulfillment = computeSalesOrderFulfillment(salesOrderId);
  const fulByLineId = new Map(fulfillment.lines.map((row) => [row.lineId, row]));

  let releasedRows = 0;
  let shrunkLines = 0;

  const activeRows = stockReservationRepository.listActiveForSalesOrder(salesOrderId);
  for (const r of activeRows) {
    if (r.qty <= 0) {
      if (stockReservationRepository.releaseActiveReservationById(r.id)) releasedRows++;
      continue;
    }

    const line = lineById.get(r.salesOrderLineId);
    if (!line) {
      if (stockReservationRepository.releaseActiveReservationById(r.id)) releasedRows++;
      continue;
    }
    if (wh === "" || normalizeTrim(r.warehouseId) !== wh) {
      if (stockReservationRepository.releaseActiveReservationById(r.id)) releasedRows++;
      continue;
    }
    if (r.itemId !== line.itemId) {
      if (stockReservationRepository.releaseActiveReservationById(r.id)) releasedRows++;
      continue;
    }

    const ful = fulByLineId.get(r.salesOrderLineId);
    if (!ful) {
      if (stockReservationRepository.releaseActiveReservationById(r.id)) releasedRows++;
      continue;
    }

    if (ful.remainingQty <= 0) {
      if (r.qty > 0) {
        stockReservationRepository.upsertActiveForSalesOrderLine({
          salesOrderId,
          salesOrderLineId: r.salesOrderLineId,
          warehouseId: wh,
          itemId: line.itemId,
          qty: 0,
        });
        releasedRows++;
      }
      continue;
    }

    if (r.qty > ful.remainingQty) {
      stockReservationRepository.upsertActiveForSalesOrderLine({
        salesOrderId,
        salesOrderLineId: r.salesOrderLineId,
        warehouseId: wh,
        itemId: line.itemId,
        qty: ful.remainingQty,
      });
      shrunkLines++;
    }
  }

  const changed = releasedRows > 0 || shrunkLines > 0;
  if (changed && emitAudit) {
    appendAuditEvent({
      entityType: "sales_order",
      entityId: salesOrderId,
      eventType: "reservation_reconciled",
      actor: AUDIT_ACTOR_LOCAL_USER,
      payload: {
        documentNumber: so.number,
        reason,
        releasedRows,
        shrunkLines,
      },
    });
  }

  return { changed, releasedRows, shrunkLines };
}
