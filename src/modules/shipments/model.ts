import type { FactualDocumentStatus } from "../../shared/domain";

/**
 * Shipment entity per docs/01_product_core/02_Domain_Model.md.
 * Factual document: factual outgoing stock.
 */
export interface Shipment {
  id: string;
  number: string;
  date: string;
  salesOrderId: string;
  warehouseId: string;
  status: FactualDocumentStatus;
  comment?: string;
  cancelReasonCode?: string;
  cancelReasonComment?: string;
}

/**
 * Shipment Line per docs/01_product_core/02_Domain_Model.md.
 */
export interface ShipmentLine {
  id: string;
  shipmentId: string;
  itemId: string;
  qty: number;
}
