import type { ColDef } from "ag-grid-community";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { StockBalanceCoverageStatus } from "@/shared/stockBalancesOperationalMetrics";
import { STOCK_STYLE_VALUES, type StockStyle } from "@/shared/inventoryStyle";
import type { StockBalanceListRow } from "./stockBalanceListRowModel";
import { buildStockBalancesTableSchema, type StockBalancesTableColumnSchema } from "./stockBalancesTableSchema";

type StockBalancesFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ColDef<StockBalanceListRow>;
  filterConfig?: AgGridColumnFilterConfig<StockBalanceListRow>;
};

export type BuildStockBalancesListViewCatalogInput = {
  t: TFunction;
  showOperationalGrid: boolean;
  styleLabel: (s: StockStyle) => string;
  coverageLabel: (s: StockBalanceCoverageStatus) => string;
  warehouseNameEnumOptions: AgGridColumnFilterOption[];
  coverageEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: StockBalancesTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "stock-balances",
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
  column: StockBalancesTableColumnSchema,
  input: BuildStockBalancesListViewCatalogInput,
): AgGridColumnFilterConfig<StockBalanceListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "enum":
      if (column.id === "warehouseName") {
        return {
          kind: "enum",
          options: input.warehouseNameEnumOptions,
          getValue: (row) => row.warehouseName,
        };
      }
      if (column.id === "style") {
        return {
          kind: "enum",
          options: STOCK_STYLE_VALUES.map((value) => ({
            value,
            label: input.styleLabel(value),
          })),
        };
      }
      if (column.id === "coverageStatus") {
        return {
          kind: "enum",
          options: input.coverageEnumOptions,
        };
      }
      return { kind: "enum", options: input.coverageEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: StockBalancesTableColumnSchema,
  input: BuildStockBalancesListViewCatalogInput,
): ColDef<StockBalanceListRow> {
  const { styleLabel } = input;

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(input.t);
  }

  const colDef: ColDef<StockBalanceListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof StockBalanceListRow & string,
  };

  if (column.id === "style") {
    colDef.valueFormatter = (params) =>
      params.value != null ? styleLabel(params.value as StockStyle) : "—";
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createStockBalancesFieldCatalog(input: BuildStockBalancesListViewCatalogInput): StockBalancesFieldCatalogEntry[] {
  const schema = buildStockBalancesTableSchema({
    t: input.t,
    showOperationalGrid: input.showOperationalGrid,
  });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

/** Full filter configs including operational fields when workspace hides those columns (URL / deep filters still apply). */
function buildExtendedFilterConfigs(
  input: BuildStockBalancesListViewCatalogInput,
): Record<string, AgGridColumnFilterConfig<StockBalanceListRow>> {
  const entries = createStockBalancesFieldCatalog(input);
  const map = Object.fromEntries(
    entries
      .filter(
        (entry): entry is StockBalancesFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<StockBalanceListRow> } =>
          Boolean(entry.filterConfig),
      )
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );

  if (input.showOperationalGrid) return map;

  const fullSchema = buildStockBalancesTableSchema({ t: input.t, showOperationalGrid: true });
  for (const column of fullSchema) {
    if (map[column.id]) continue;
    const cfg = mapSchemaToFilterConfig(column, input);
    if (cfg) map[column.id] = cfg;
  }
  return map;
}

export function buildStockBalancesListViewCatalog(input: BuildStockBalancesListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ColDef<StockBalanceListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<StockBalanceListRow>>;
} {
  const entries = createStockBalancesFieldCatalog(input);
  const filterConfigs = buildExtendedFilterConfigs(input);

  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}
