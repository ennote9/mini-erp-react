/**
 * Item entity per docs/01_product_core/02_Domain_Model.md.
 * Master data: sellable/receivable product.
 */
export interface Item {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
  description?: string;
  brandId?: string;
  category?: string;
  barcode?: string;
  purchasePrice?: number;
  salePrice?: number;
}
