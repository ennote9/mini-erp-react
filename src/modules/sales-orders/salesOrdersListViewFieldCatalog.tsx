import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import { normalizeDateForSO } from "./dateUtils";
import type { SalesOrderListRow } from "./salesOrderListRowModel";
import { buildSalesOrdersTableSchema, type SalesOrdersTableColumnSchema } from "./salesOrdersTableSchema";

type SalesOrdersFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<SalesOrderListRow>;
  filterConfig?: AgGridColumnFilterConfig<SalesOrderListRow>;
};

export type BuildSalesOrdersListViewCatalogInput = {
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  customerNameEnumOptions: AgGridColumnFilterOption[];
  warehouseNameEnumOptions: AgGridColumnFilterOption[];
  statusEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: SalesOrdersTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "sales-orders",
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
  column: SalesOrdersTableColumnSchema,
  input: BuildSalesOrdersListViewCatalogInput,
): AgGridColumnFilterConfig<SalesOrderListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "date":
      return { kind: "date" };
    case "enum":
      if (column.id === "customerName") {
        return {
          kind: "enum",
          options: input.customerNameEnumOptions,
          getValue: (row) => row.customerName,
        };
      }
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
  column: SalesOrdersTableColumnSchema,
  input: BuildSalesOrdersListViewCatalogInput,
): ListColumnDef<SalesOrderListRow> {
  const { t, formatDate } = input;

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ListColumnDef<SalesOrderListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof SalesOrderListRow & string,
  };

  if (column.id === "date") {
    colDef.valueFormatter = (params) =>
      formatDate(normalizeDateForSO(params.value == null ? undefined : String(params.value)), { empty: "" });
  }

  if (column.id === "status") {
    colDef.valueFormatter = (params) => {
      const v = params.value as string | undefined;
      if (v == null || v === "") return "";
      return t(`status.labels.${v}`);
    };
  }

  if (column.id === "carrierLabel" || column.id === "recipientLabel" || column.id === "recipientPhoneLabel") {
    colDef.valueFormatter = (params) => String(params.value ?? "");
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createSalesOrdersFieldCatalog(input: BuildSalesOrdersListViewCatalogInput): SalesOrdersFieldCatalogEntry[] {
  const schema = buildSalesOrdersTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildSalesOrdersListViewCatalog(input: BuildSalesOrdersListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<SalesOrderListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<SalesOrderListRow>>;
} {
  const entries = createSalesOrdersFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (
          entry,
        ): entry is SalesOrdersFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<SalesOrderListRow> } =>
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
