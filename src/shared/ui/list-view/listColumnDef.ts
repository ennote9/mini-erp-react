/**
 * Column metadata shape for ERP list pages (column settings persistence, field catalogs).
 * Column metadata for list views rendered with TanStack Table (persisted column settings, field catalogs).
 */
export type ListColumnDefValueGetterParams<T = unknown> = {
  node?: { rowIndex?: number | null } | null;
  data?: T;
};

export type ListColumnDefValueFormatterParams = {
  value: unknown;
};

export type ListColumnDef<T = unknown> = {
  colId?: string;
  field?: string;
  headerName?: string;
  sortable?: boolean;
  resizable?: boolean;
  /** Initial width in pixels (legacy AG name retained in persisted JSON). */
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  initialFlex?: number;
  initialHide?: boolean;
  hide?: boolean;
  cellDataType?: string | boolean;
  tooltipValueGetter?: (params: ListColumnDefValueGetterParams<T>) => string | undefined;
  lockPosition?: string | boolean;
  lockVisible?: boolean;
  suppressMovable?: boolean;
  pinned?: "left" | "right" | boolean | null;
  valueGetter?: (params: ListColumnDefValueGetterParams<T>) => unknown;
  valueFormatter?: (params: ListColumnDefValueFormatterParams) => string;
};
