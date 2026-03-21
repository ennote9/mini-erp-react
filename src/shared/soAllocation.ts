/**
 * Sales order stock allocation view: fulfillment + reservations + availability (MVP).
 * Id-based matching only. Reservations are warehouse + item + SO line.
 */

import { salesOrderRepository } from "../modules/sales-orders/repository";
import { stockBalanceRepository } from "../modules/stock-balances/repository";
import { stockReservationRepository } from "../modules/stock-reservations/repository";
import { computeSalesOrderFulfillment, type SoLineFulfillment } from "./planningFulfillment";

export type SalesOrderAllocationState = "not_allocated" | "partial" | "allocated" | "short";

export type SoLineAllocationRow = SoLineFulfillment & {
  reservedQty: number;
  /** max(0, remainingQty - reservedQty) — portion of remaining not yet reserved */
  shortageQty: number;
  /** Additional qty this line could receive on next Allocate (deterministic cap). */
  availableToAllocate: number;
};

export type SalesOrderAllocationView = {
  lines: SoLineAllocationRow[];
  totalOrdered: number;
  totalShipped: number;
  totalRemaining: number;
  totalReserved: number;
  totalShortage: number;
  state: SalesOrderAllocationState;
};

function capAllocationState(
  lines: SoLineAllocationRow[],
  totalReserved: number,
): SalesOrderAllocationState {
  if (lines.length === 0) return "not_allocated";

  const allDone = lines.every(
    (l) => l.remainingQty <= 0 || l.reservedQty >= l.remainingQty,
  );
  if (totalReserved <= 0 && lines.some((l) => l.remainingQty > 0)) {
    return "not_allocated";
  }
  if (allDone) return "allocated";

  const anyShort =
    lines.some(
      (l) =>
        l.remainingQty > 0 &&
        l.reservedQty < l.remainingQty &&
        l.availableToAllocate <= 0,
    );
  if (anyShort) return "short";

  return "partial";
}

/**
 * Snapshot of reservation / availability per SO line (for UI and allocateStock).
 */
export function computeSalesOrderAllocationView(salesOrderId: string): SalesOrderAllocationView {
  const fulfillment = computeSalesOrderFulfillment(salesOrderId);
  const so = salesOrderRepository.getById(salesOrderId);
  const warehouseId = so?.warehouseId?.trim() ?? "";

  const lines: SoLineAllocationRow[] = [];
  let totalReserved = 0;
  let totalShortage = 0;

  for (const base of fulfillment.lines) {
    const reservedQty = stockReservationRepository.getActiveQtyForSalesOrderLine(
      salesOrderId,
      base.lineId,
    );
    const onHand =
      warehouseId !== ""
        ? stockBalanceRepository.getByItemAndWarehouse(base.itemId, warehouseId)?.qtyOnHand ?? 0
        : 0;
    const T = stockReservationRepository.sumActiveQtyForWarehouseItem(warehouseId, base.itemId);
    const R = reservedQty;
    const shortageQty = Math.max(0, base.remainingQty - R);
    const maxTotalForLine =
      warehouseId !== ""
        ? Math.min(base.remainingQty, Math.max(0, onHand - (T - R)))
        : 0;
    const availableToAllocate = Math.max(0, maxTotalForLine - R);

    totalReserved += R;
    totalShortage += shortageQty;

    lines.push({
      ...base,
      reservedQty,
      shortageQty,
      availableToAllocate,
    });
  }

  const state = capAllocationState(lines, totalReserved);

  return {
    lines,
    totalOrdered: fulfillment.totalOrdered,
    totalShipped: fulfillment.totalShipped,
    totalRemaining: fulfillment.totalRemaining,
    totalReserved,
    totalShortage,
    state,
  };
}

export function salesOrderAllocationStateLabel(state: SalesOrderAllocationState): string {
  switch (state) {
    case "not_allocated":
      return "Not allocated";
    case "partial":
      return "Partial";
    case "allocated":
      return "Allocated";
    case "short":
      return "Short";
    default:
      return state;
  }
}
