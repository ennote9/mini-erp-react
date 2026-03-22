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
  /** Optional default carrier for shipments created for this customer's sales orders. */
  preferredCarrierId?: string;
  /** Default delivery details for new/edited sales orders when customer is selected (trimmed; empty not stored). */
  defaultRecipientName?: string;
  defaultRecipientPhone?: string;
  defaultDeliveryAddress?: string;
  defaultDeliveryComment?: string;
}
