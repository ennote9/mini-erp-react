import type { GridApi, IRowNode } from "ag-grid-community";

export type AgGridExportColumn = {
  colId: string;
  headerName: string;
};

function isExportableColumnId(colId: string): boolean {
  return colId !== "selection";
}

export function getVisibleAgGridExportColumns(api: GridApi): AgGridExportColumn[] {
  const cols = api.getAllDisplayedColumns();
  return cols
    .map((col) => {
      const colId = col.getColId();
      const def = col.getColDef();
      const headerName = typeof def.headerName === "string" && def.headerName.trim() !== "" ? def.headerName : colId;
      return { colId, headerName };
    })
    .filter((col) => isExportableColumnId(col.colId));
}

function normalizeCellValue(value: unknown): string | number {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function buildExportMatrixFromRowNodes<TData>(
  api: GridApi<TData>,
  columns: AgGridExportColumn[],
  rowNodes: Array<IRowNode<TData>>,
): Array<Array<string | number>> {
  const anyApi = api as unknown as { getValue?: (colKey: string, rowNode: IRowNode<TData>) => unknown };
  return rowNodes.map((rowNode) =>
    columns.map((column) => normalizeCellValue(anyApi.getValue?.(column.colId, rowNode))),
  );
}

export function collectFilteredSortedRowNodes<TData>(api: GridApi<TData>): Array<IRowNode<TData>> {
  const rows: Array<IRowNode<TData>> = [];
  api.forEachNodeAfterFilterAndSort((node) => {
    rows.push(node);
  });
  return rows;
}
