import type { Carrier } from "./model";

/** Row type for the Carriers TanStack list — same shape as `Carrier`; line numbers are view-derived. */
export type CarrierListRow = Carrier;

export function buildCarrierListRows(carriers: Carrier[]): CarrierListRow[] {
  return carriers;
}
