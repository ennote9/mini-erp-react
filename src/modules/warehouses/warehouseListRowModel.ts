import type { Warehouse } from "./model";

/** Row type for the Warehouses TanStack list — same shape as `Warehouse`; line numbers are view-derived. */
export type WarehouseListRow = Warehouse;

export function buildWarehouseListRows(warehouses: Warehouse[]): WarehouseListRow[] {
  return warehouses;
}
