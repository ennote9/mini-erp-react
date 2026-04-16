import type { ColDef } from "ag-grid-community";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { ReceiptListRow } from "./receiptListRowModel";
import { buildReceiptsTableSchema, type ReceiptsTableColumnSchema } from "./receiptsTableSchema";

type ReceiptsFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ColDef<ReceiptListRow>;
  filterConfig?: AgGridColumnFilterConfig<ReceiptListRow>;
};

export type BuildReceiptsListViewCatalogInput = {
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  warehouseNameEnumOptions: AgGridColumnFilterOption[];
  statusEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: ReceiptsTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "receipts",
    label: column.label,
    dataType: column.dataType,
    sourceType: column.sourceType,
    defaultVisible: column.defaultVisible,
    lockedVisible: column.lockedVisible,
    sortable: column.sortable,
    filterable: column.filterable,
    exportable: column.exportable,
    selectable: column.selectable,
    rendererType: column.rendererType,
    requiresPermission: null,
    performanceCost: column.performanceCost,
  };
}

function mapSchemaToFilterConfig(
  column: ReceiptsTableColumnSchema,
  input: BuildReceiptsListViewCatalogInput,
): AgGridColumnFilterConfig<ReceiptListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "date":
      return { kind: "date" };
    case "enum":
      if (column.id === "warehouseName") {
        return {
          kind: "enum",
          options: input.warehouseNameEnumOptions,
          getValue: (row) => row.warehouseName,
        };
      }
      if (column.id === "status") {
        return {
          kind: "enum",
          options: input.statusEnumOptions,
          getValue: (row) => row.status,
        };
      }
      return { kind: "enum", options: input.statusEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: ReceiptsTableColumnSchema,
  input: BuildReceiptsListViewCatalogInput,
): ColDef<ReceiptListRow> {
  const { t, formatDate } = input;

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ColDef<ReceiptListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof ReceiptListRow & string,
  };

  if (column.id === "date") {
    colDef.valueFormatter = (params) =>
      formatDate(params.value == null ? undefined : String(params.value), { empty: "" });
  }

  if (column.id === "status") {
    colDef.valueFormatter = (params) => {
      const v = params.value as string | undefined;
      if (v == null || v === "") return "";
      return t(`status.labels.${v}`);
    };
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createReceiptsFieldCatalog(input: BuildReceiptsListViewCatalogInput): ReceiptsFieldCatalogEntry[] {
  const schema = buildReceiptsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildReceiptsListViewCatalog(input: BuildReceiptsListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ColDef<ReceiptListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<ReceiptListRow>>;
} {
  const entries = createReceiptsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is ReceiptsFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<ReceiptListRow> } =>
          Boolean(entry.filterConfig),
      )
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );

  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}
