/**
 * Warehouse entity per docs/01_product_core/02_Domain_Model.md.
 * Master data: warehouse dimension for stock balances and movements.
 */
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  comment?: string;
}
