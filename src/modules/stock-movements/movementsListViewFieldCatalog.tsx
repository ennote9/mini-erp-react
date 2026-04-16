import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { StockMovementListRow } from "./movementListRowModel";
import { buildMovementsTableSchema, type MovementsTableColumnSchema } from "./movementsTableSchema";

type MovementsFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<StockMovementListRow>;
  filterConfig?: AgGridColumnFilterConfig<StockMovementListRow>;
};

export type BuildMovementsListViewCatalogInput = {
  t: TFunction;
  movementTypeLabel: (code: string) => string;
  warehouseNameEnumOptions: AgGridColumnFilterOption[];
  movementTypeEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: MovementsTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "stock-movements",
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
  column: MovementsTableColumnSchema,
  input: BuildMovementsListViewCatalogInput,
): AgGridColumnFilterConfig<StockMovementListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      if (column.id === "sourceDocumentLabel") {
        return { kind: "text", getValue: (row) => row.sourceDocumentLabel };
      }
      if (column.id === "relatedOrder") {
        return { kind: "text", getValue: (row) => row.relatedOrderLabel };
      }
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "datetime":
      return { kind: "datetime" };
    case "enum":
      if (column.id === "warehouseName") {
        return {
          kind: "enum",
          options: input.warehouseNameEnumOptions,
          getValue: (row) => row.warehouseName,
        };
      }
      if (column.id === "movementType") {
        return {
          kind: "enum",
          options: input.movementTypeEnumOptions,
          getValue: (row) => input.movementTypeLabel(row.movementType),
        };
      }
      return { kind: "enum", options: input.movementTypeEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: MovementsTableColumnSchema,
  input: BuildMovementsListViewCatalogInput,
): ListColumnDef<StockMovementListRow> {
  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(input.t);
  }

  const fieldKey = (column.accessorKey ?? column.id) as keyof StockMovementListRow & string;

  const colDef: ListColumnDef<StockMovementListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: fieldKey,
  };

  if (column.id === "relatedOrder") {
    colDef.field = "relatedOrderLabel";
    colDef.colId = "relatedOrder";
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createMovementsFieldCatalog(input: BuildMovementsListViewCatalogInput): MovementsFieldCatalogEntry[] {
  const schema = buildMovementsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildMovementsListViewCatalog(input: BuildMovementsListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<StockMovementListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<StockMovementListRow>>;
} {
  const entries = createMovementsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is MovementsFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<StockMovementListRow> } =>
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
