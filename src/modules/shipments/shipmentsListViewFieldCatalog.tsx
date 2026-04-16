import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { ShipmentListRow } from "./shipmentListRowModel";
import { buildShipmentsTableSchema, type ShipmentsTableColumnSchema } from "./shipmentsTableSchema";

type ShipmentsFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<ShipmentListRow>;
  filterConfig?: AgGridColumnFilterConfig<ShipmentListRow>;
};

export type BuildShipmentsListViewCatalogInput = {
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  warehouseNameEnumOptions: AgGridColumnFilterOption[];
  statusEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: ShipmentsTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "shipments",
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
  column: ShipmentsTableColumnSchema,
  input: BuildShipmentsListViewCatalogInput,
): AgGridColumnFilterConfig<ShipmentListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      if (column.id === "trackingLabel") {
        return { kind: "text", getValue: (row) => row.trackingRaw };
      }
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
  column: ShipmentsTableColumnSchema,
  input: BuildShipmentsListViewCatalogInput,
): ListColumnDef<ShipmentListRow> {
  const { t, formatDate } = input;

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ListColumnDef<ShipmentListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof ShipmentListRow & string,
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

  if (column.id === "carrierLabel" || column.id === "recipientLabel" || column.id === "recipientPhoneLabel") {
    colDef.valueFormatter = (params) => String(params.value ?? "");
  }

  if (column.id === "deliveryAddressPreview") {
    colDef.valueFormatter = (params) => String(params.value ?? "");
    colDef.tooltipValueGetter = (params) => {
      const full = params.data?.deliveryAddressFull ?? "";
      return full.trim() === "" ? undefined : full;
    };
  }

  if (column.id === "trackingLabel") {
    colDef.field = "trackingLabel";
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createShipmentsFieldCatalog(input: BuildShipmentsListViewCatalogInput): ShipmentsFieldCatalogEntry[] {
  const schema = buildShipmentsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildShipmentsListViewCatalog(input: BuildShipmentsListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<ShipmentListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<ShipmentListRow>>;
} {
  const entries = createShipmentsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is ShipmentsFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<ShipmentListRow> } =>
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
