import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { WarehouseListRow } from "./warehouseListRowModel";
import {
  buildWarehousesTableSchema,
  type WarehousesTableColumnSchema,
} from "./warehousesTableSchema";

type WarehouseFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<WarehouseListRow>;
  filterConfig?: AgGridColumnFilterConfig<WarehouseListRow>;
};

type BuildWarehousesFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  /** Distinct warehouse types from current data — matches legacy AG Grid enum filter options. */
  warehouseTypeEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: WarehousesTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "warehouses",
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
  column: WarehousesTableColumnSchema,
  input: BuildWarehousesFieldCatalogInput,
): AgGridColumnFilterConfig<WarehouseListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "enum":
      return { kind: "enum", options: input.warehouseTypeEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: WarehousesTableColumnSchema,
  input: BuildWarehousesFieldCatalogInput,
): ListColumnDef<WarehouseListRow> {
  const { t, formatMoney } = input;
  const emDash = t("domain.audit.summary.emDash");

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ListColumnDef<WarehouseListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof WarehouseListRow & string,
  };

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  if (column.formatKind === "yes-no") {
    const yesLabel = t("common.yes");
    const noLabel = t("common.no");
    colDef.valueFormatter = (params) => (params.value ? yesLabel : noLabel);
  }

  if (column.formatKind === "optional-text") {
    colDef.valueFormatter = (params) => {
      const v = params.value;
      if (v == null || v === "") return emDash;
      return String(v);
    };
  }

  void formatMoney;
  return colDef;
}

function createWarehousesFieldCatalog(input: BuildWarehousesFieldCatalogInput): WarehouseFieldCatalogEntry[] {
  const schema = buildWarehousesTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildWarehousesListViewCatalog(input: BuildWarehousesFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<WarehouseListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<WarehouseListRow>>;
} {
  const entries = createWarehousesFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is WarehouseFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<WarehouseListRow> } =>
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
