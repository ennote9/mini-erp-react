import type { StockStyle } from "@/shared/inventoryStyle";

/**
 * Stock Balance entity per docs/01_product_core/02_Domain_Model.md.
 * Current available quantity by item and warehouse.
 * Stored for performance; logically derived from movements. Not editable manually.
 */
export interface StockBalance {
  id: string;
  itemId: string;
  warehouseId: string;
  style: StockStyle;
  qtyOnHand: number;
}
