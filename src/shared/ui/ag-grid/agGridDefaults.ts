import type { ColDef, GridOptions } from "ag-grid-community";

/**
 * Grid options applied across ERP grids so visible cell values can be selected/copied.
 * (AG root defaults to .ag-unselectable; this toggles selectable cell value behavior.)
 */
export const agGridDefaultGridOptions = {
  enableCellTextSelection: true,
} as const satisfies Pick<GridOptions, "enableCellTextSelection">;

/**
 * Shared default column definition for list-page AG Grids.
 * Used by Stock Movements and Stock Balances; override per column as needed.
 */
export const agGridDefaultColDef: ColDef = {
  sortable: true,
  resizable: true,
};

/** Column with row index (1-based). Always first. */
export const agGridRowNumberColDef: ColDef = {
  headerName: "№",
  valueGetter: (params) =>
    params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
  width: 56,
  minWidth: 56,
  maxWidth: 56,
  lockPosition: "left",
  suppressMovable: true,
  sortable: false,
  resizable: false,
};

/** Selection column (checkboxes) - use as selectionColumnDef when rowSelection is set. AG Grid 32.2+ */
export const agGridSelectionColumnDef: ColDef = {
  width: 52,
  minWidth: 52,
  maxWidth: 52,
  lockPosition: "left",
  suppressMovable: true,
  sortable: false,
  resizable: false,
};
