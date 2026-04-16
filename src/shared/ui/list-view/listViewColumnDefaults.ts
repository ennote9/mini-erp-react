import type { TFunction } from "@/shared/i18n/resolve";
import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";

/** Column with row index (1-based). Always first. Used by list view field catalogs. */
export const listViewRowNumberColumnDef: ListColumnDef = {
  colId: "lineNo",
  headerName: "№",
  valueGetter: (params) =>
    params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : "",
  initialWidth: 56,
  minWidth: 56,
  maxWidth: 56,
  lockPosition: "left",
  suppressMovable: true,
  sortable: false,
  resizable: false,
};

/** Localized № header; use inside `useMemo` with `[t, locale]` so headers refresh on language change. */
export function getListViewRowNumberColumnDef(t: TFunction): ListColumnDef {
  return {
    ...listViewRowNumberColumnDef,
    headerName: t("doc.columns.lineNo"),
  };
}
