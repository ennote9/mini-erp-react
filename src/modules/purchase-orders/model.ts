import type { PlanningDocumentStatus } from "../../shared/domain";

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
  comment?: string;
}

/**
 * Purchase Order Line per docs/01_product_core/02_Domain_Model.md.
 */
export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  itemId: string;
  qty: number;
}
