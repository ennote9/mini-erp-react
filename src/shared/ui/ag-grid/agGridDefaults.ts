import type { ColDef } from "ag-grid-community";

/**
 * Shared default column definition for list-page AG Grids.
 * Used by Stock Movements and Stock Balances; override per column as needed.
 */
export const agGridDefaultColDef: ColDef = {
  sortable: true,
  resizable: true,
};
