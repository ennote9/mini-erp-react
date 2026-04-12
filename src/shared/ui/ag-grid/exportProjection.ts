import type { GridApi, IRowNode } from "ag-grid-community";
import { getListViewFieldRegistry, type ListViewEntityType } from "./listViewConfig";

export type AgGridExportColumn = {
  colId: string;
  headerName: string;
};

function isExportableColumnId(colId: string): boolean {
  if (colId === "selection") return false;
  if (colId === "ag-Grid-SelectionColumn") return false;
  return true;
}

export function getVisibleAgGridExportColumns(
  api: GridApi,
  options?: { entityType?: ListViewEntityType },
): AgGridExportColumn[] {
  const cols = api.getAllDisplayedColumns();
  const exportableByField = options?.entityType
    ? new Map(getListViewFieldRegistry(options.entityType).map((field) => [field.fieldKey, field.exportable]))
    : null;
  return cols
    .map((col) => {
      const colId = col.getColId();
      const def = col.getColDef();
      const headerName = typeof def.headerName === "string" && def.headerName.trim() !== "" ? def.headerName : colId;
      return { colId, headerName };
    })
    .filter((col) => {
      if (!isExportableColumnId(col.colId)) return false;
      if (!exportableByField) return true;
      const exportable = exportableByField.get(col.colId);
      return exportable !== false;
    });
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
