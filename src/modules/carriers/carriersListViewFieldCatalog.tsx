import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { CarrierListRow } from "./carrierListRowModel";
import {
  buildCarriersTableSchema,
  type CarriersTableColumnSchema,
} from "./carriersTableSchema";
import { translateCarrierType } from "./carrierLabels";

type CarrierFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<CarrierListRow>;
  filterConfig?: AgGridColumnFilterConfig<CarrierListRow>;
};

type BuildCarriersFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
  /** Translated carrier type labels — matches legacy AG Grid enum filter (distinct, sorted). */
  carrierTypeEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: CarriersTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "carriers",
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
  column: CarriersTableColumnSchema,
  input: BuildCarriersFieldCatalogInput,
): AgGridColumnFilterConfig<CarrierListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "enum":
      if (column.id === "carrierType") {
        return {
          kind: "enum",
          options: input.carrierTypeEnumOptions,
          getValue: (row) => translateCarrierType(input.t, row.carrierType),
        };
      }
      return { kind: "enum", options: input.carrierTypeEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: CarriersTableColumnSchema,
  input: BuildCarriersFieldCatalogInput,
): ListColumnDef<CarrierListRow> {
  const { t, formatMoney } = input;
  const emDash = t("domain.audit.summary.emDash");

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ListColumnDef<CarrierListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof CarrierListRow & string,
  };

  if (column.id === "carrierType") {
    colDef.valueGetter = (p) => (p.data ? translateCarrierType(t, p.data.carrierType) : "");
  }

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

function createCarriersFieldCatalog(input: BuildCarriersFieldCatalogInput): CarrierFieldCatalogEntry[] {
  const schema = buildCarriersTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildCarriersListViewCatalog(input: BuildCarriersFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<CarrierListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<CarrierListRow>>;
} {
  const entries = createCarriersFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is CarrierFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<CarrierListRow> } =>
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
