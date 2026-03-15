/**
 * Supplier entity per docs/01_product_core/02_Domain_Model.md.
 * Master data: vendor from whom stock is purchased.
 */
export interface Supplier {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  comment?: string;
}
