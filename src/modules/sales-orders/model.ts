import type { PlanningDocumentStatus } from "../../shared/domain";

export interface SalesOrderAttachment {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  contentBase64: string;
  addedAt: string;
}

/**
 * Sales Order entity per docs/01_product_core/02_Domain_Model.md.
 * Planning document: intention to sell stock to a customer.
 */
export interface SalesOrder {
  id: string;
  number: string;
  date: string;
  customerId: string;
  warehouseId: string;
  status: PlanningDocumentStatus;
  /** Optional preliminary shipment date (YYYY-MM-DD). */
  preliminaryShipmentDate?: string;
  /** Optional actual shipment date (YYYY-MM-DD). */
  actualShipmentDate?: string;
  /** Net payment terms in whole days (optional). Empty on document = none / not specified. */
  paymentTermsDays?: number;
  /** Due date YYYY-MM-DD derived from date + paymentTermsDays when terms are set; omitted when terms unset. */
  dueDate?: string;
  comment?: string;
  attachments?: SalesOrderAttachment[];
  cancelReasonCode?: string;
  cancelReasonComment?: string;
  /** Optional carrier for shipments; defaults from customer preferred carrier, overridable per order. */
  carrierId?: string;
  /** Optional delivery details; defaults onto new shipments when created (editable on shipment). */
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  deliveryComment?: string;
}

/**
 * Sales Order Line per docs/01_product_core/02_Domain_Model.md.
 */
export interface SalesOrderLine {
  id: string;
  salesOrderId: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  /** Optional markdown unit code when this line targets a specific markdown unit. */
  markdownCode?: string;
  zeroPriceReasonCode?: string;
}
