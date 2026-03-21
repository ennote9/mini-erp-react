/**
 * Sales-side stock reservation (MVP): warehouse + item + SO line.
 * Not lot/serial; not purchase-side.
 */

export type StockReservationStatus = "active" | "consumed" | "released";

export interface StockReservation {
  id: string;
  warehouseId: string;
  itemId: string;
  salesOrderId: string;
  /** Stable id from SalesOrderLine.id */
  salesOrderLineId: string;
  qty: number;
  status: StockReservationStatus;
  createdAt: string;
  updatedAt: string;
}
