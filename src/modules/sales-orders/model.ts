import type { PlanningDocumentStatus } from "../../shared/domain";

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
  /** Net payment terms in whole days (optional). Empty on document = none / not specified. */
  paymentTermsDays?: number;
  /** Due date YYYY-MM-DD derived from date + paymentTermsDays when terms are set; omitted when terms unset. */
  dueDate?: string;
  comment?: string;
  cancelReasonCode?: string;
  cancelReasonComment?: string;
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
  zeroPriceReasonCode?: string;
}
