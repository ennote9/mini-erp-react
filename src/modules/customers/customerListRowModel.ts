import type { Customer } from "./model";

/** Row type for the Customers TanStack list — same shape as `Customer`; line numbers are view-derived. */
export type CustomerListRow = Customer;

export function buildCustomerListRows(customers: Customer[]): CustomerListRow[] {
  return customers;
}
