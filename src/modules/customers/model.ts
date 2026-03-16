/**
 * Customer entity per docs/01_product_core/02_Domain_Model.md.
 * Master data: buyer to whom stock is sold.
 */
export interface Customer {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  comment?: string;
  contactPerson?: string;
  taxId?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  country?: string;
  paymentTermsDays?: number;
}
