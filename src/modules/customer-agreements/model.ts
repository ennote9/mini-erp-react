export type CustomerAgreementPricingType = "discount_percent" | "fixed_price" | "price_list";

export interface CustomerAgreement {
  id: string;
  customerId: string;
  agreementNo: string;
  name?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  currency: string;
  pricingType: CustomerAgreementPricingType;
  discountPercent?: number;
  paymentTermsDays?: number;
  createdAt: string;
  updatedAt: string;
}

