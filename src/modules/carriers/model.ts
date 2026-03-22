/**
 * Carrier master data: delivery / shipping partners (couriers, postal, 3PL, own fleet, marketplace logistics).
 */

export const CARRIER_TYPE_IDS = [
  "courier",
  "postal",
  "transport_company",
  "own_delivery",
  "marketplace_logistics",
] as const;

export type CarrierTypeId = (typeof CARRIER_TYPE_IDS)[number];

export function isCarrierTypeId(value: string): value is CarrierTypeId {
  return (CARRIER_TYPE_IDS as readonly string[]).includes(value);
}

export interface Carrier {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  carrierType: CarrierTypeId;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  country?: string;
  city?: string;
  address?: string;
  comment?: string;
  /** Optional URL template; use e.g. {{trackingNumber}} as placeholder for future shipment integration. */
  trackingUrlTemplate?: string;
  serviceLevelDefault?: string;
  paymentTermsDays?: number;
}
