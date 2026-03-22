import type { FactualDocumentStatus } from "../../shared/domain";
import type { ReversalDocumentReasonCode } from "../../shared/reasonCodes";

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
  /** Set when status is `reversed` (posted shipment was reversed). */
  reversalReasonCode?: ReversalDocumentReasonCode;
  reversalReasonComment?: string;
  /** Optional delivery partner (Carriers master data). */
  carrierId?: string;
  /** Optional tracking / waybill reference (trimmed; empty not stored). */
  trackingNumber?: string;
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
