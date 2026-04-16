import type { ColDef } from "ag-grid-community";
import type { TFunction } from "@/shared/i18n";
import type { ItemBarcodeSymbology } from "@/modules/items";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type {
  BarcodeRegistryEntryType,
  BarcodeRegistryRow,
  BarcodeRegistrySource,
} from "./barcodeRegistryReadModel";
import {
  buildBarcodeRegistryTableSchema,
  type BarcodeRegistryTableColumnSchema,
} from "./barcodeRegistryTableSchema";

type BarcodeRegistryFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ColDef<BarcodeRegistryRow>;
  filterConfig?: AgGridColumnFilterConfig<BarcodeRegistryRow>;
};

export type BuildBarcodeRegistryFieldCatalogInput = {
  t: TFunction;
  entryTypeLabel: (value: BarcodeRegistryEntryType) => string;
  sourceLabel: (value: BarcodeRegistrySource) => string;
  symbologyLabel: (value?: ItemBarcodeSymbology) => string;
  markdownStatusLabel: (value?: string) => string;
  entryTypeEnumOptions: AgGridColumnFilterOption[];
  sourceEnumOptions: AgGridColumnFilterOption[];
  symbologyEnumOptions: AgGridColumnFilterOption[];
  markdownStatusEnumOptions: AgGridColumnFilterOption[];
};

function mapSchemaToRegistry(column: BarcodeRegistryTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "barcodes",
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
  column: BarcodeRegistryTableColumnSchema,
  input: BuildBarcodeRegistryFieldCatalogInput,
): AgGridColumnFilterConfig<BarcodeRegistryRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "boolean":
      return { kind: "boolean" };
    case "datetime":
      return { kind: "datetime" };
    case "enum":
      if (column.id === "entryType") {
        return { kind: "enum", options: input.entryTypeEnumOptions };
      }
      if (column.id === "source") {
        return {
          kind: "enum",
          options: input.sourceEnumOptions,
          getValue: (row) => row.source,
        };
      }
      if (column.id === "symbology") {
        return {
          kind: "enum",
          options: input.symbologyEnumOptions,
          getValue: (row) => row.symbology ?? "",
        };
      }
      if (column.id === "markdownStatus") {
        return {
          kind: "enum",
          options: input.markdownStatusEnumOptions,
          getValue: (row) => row.markdownStatus ?? "",
        };
      }
      return { kind: "enum", options: input.entryTypeEnumOptions };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: BarcodeRegistryTableColumnSchema,
  input: BuildBarcodeRegistryFieldCatalogInput,
): ColDef<BarcodeRegistryRow> {
  const { t, entryTypeLabel, sourceLabel, symbologyLabel, markdownStatusLabel } = input;
  const emDash = t("domain.audit.summary.emDash");

  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ColDef<BarcodeRegistryRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof BarcodeRegistryRow & string,
  };

  if (column.id === "entryType") {
    colDef.valueGetter = (p) => (p.data ? entryTypeLabel(p.data.entryType) : "");
  }
  if (column.id === "source") {
    colDef.valueFormatter = (params) => sourceLabel(params.value as BarcodeRegistrySource);
  }
  if (column.id === "symbology") {
    colDef.valueFormatter = (params) => symbologyLabel(params.value as ItemBarcodeSymbology | undefined);
  }
  if (column.id === "markdownStatus") {
    colDef.valueFormatter = (params) => markdownStatusLabel(params.value as string | undefined);
  }
  if (column.id === "createdAt") {
    colDef.valueFormatter = (params) => params.value || emDash;
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

  if (column.formatKind === "optional-text" && column.id !== "createdAt") {
    colDef.valueFormatter = (params) => {
      const v = params.value;
      if (v == null || v === "") return emDash;
      return String(v);
    };
  }

  return colDef;
}

function createBarcodeRegistryFieldCatalog(
  input: BuildBarcodeRegistryFieldCatalogInput,
): BarcodeRegistryFieldCatalogEntry[] {
  const schema = buildBarcodeRegistryTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildBarcodeRegistryListViewCatalog(input: BuildBarcodeRegistryFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ColDef<BarcodeRegistryRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<BarcodeRegistryRow>>;
} {
  const entries = createBarcodeRegistryFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is BarcodeRegistryFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<BarcodeRegistryRow> } =>
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
