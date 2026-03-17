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
  comment?: string;
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
}
