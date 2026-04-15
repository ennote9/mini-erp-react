import type { Supplier } from "./model";

/** Row type for the Suppliers TanStack list — same shape as `Supplier`; line numbers are view-derived. */
export type SupplierListRow = Supplier;

export function buildSupplierListRows(suppliers: Supplier[]): SupplierListRow[] {
  return suppliers;
}
