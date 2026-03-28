import type { PlanningDocumentStatus } from "../../shared/domain";

export interface PurchaseOrderAttachment {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  contentBase64: string;
  addedAt: string;
}

/**
 * Purchase Order entity per docs/01_product_core/02_Domain_Model.md.
 * Planning document: intention to buy stock from a supplier.
 */
export interface PurchaseOrder {
  id: string;
  number: string;
  date: string;
  supplierId: string;
  warehouseId: string;
  status: PlanningDocumentStatus;
  /** Net payment terms in whole days (optional). Empty on document = none / not specified. */
  paymentTermsDays?: number;
  /** Due date YYYY-MM-DD derived from date + paymentTermsDays when terms are set; omitted when terms unset. */
  dueDate?: string;
  comment?: string;
  attachments?: PurchaseOrderAttachment[];
  /** Set when status becomes cancelled (controlled exception). */
  cancelReasonCode?: string;
  cancelReasonComment?: string;
}

/**
 * Purchase Order Line per docs/01_product_core/02_Domain_Model.md.
 */
export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  /** Required in business rules when unitPrice is 0. */
  zeroPriceReasonCode?: string;
}
