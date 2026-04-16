import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type { ListViewColumnFilterConfig, ListViewFieldRegistryEntry } from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import type { BrandListRow } from "./brandListRowModel";
import {
  buildBrandsTableSchema,
  type BrandsTableColumnSchema,
} from "./brandsTableSchema";

type BrandFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<BrandListRow>;
  filterConfig?: ListViewColumnFilterConfig<BrandListRow>;
};

type BuildBrandsFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function mapSchemaToRegistry(column: BrandsTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "brands",
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
  column: BrandsTableColumnSchema,
): ListViewColumnFilterConfig<BrandListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "boolean":
      return { kind: "boolean" };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: BrandsTableColumnSchema,
  input: BuildBrandsFieldCatalogInput,
): ListColumnDef<BrandListRow> {
  const { t, formatMoney } = input;
  if (column.id === "lineNo") {
    return getListViewRowNumberColumnDef(t);
  }

  const colDef: ListColumnDef<BrandListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof BrandListRow & string,
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

  if (column.id === "comment") {
    colDef.valueFormatter = (params) => {
      const v = params.value;
      if (v == null || v === "") return "—";
      return String(v);
    };
  }

  void formatMoney;
  return colDef;
}

function createBrandsFieldCatalog(input: BuildBrandsFieldCatalogInput): BrandFieldCatalogEntry[] {
  const schema = buildBrandsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column),
  }));
}

export function buildBrandsListViewCatalog(input: BuildBrandsFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<BrandListRow>[];
  filterConfigs: Record<string, ListViewColumnFilterConfig<BrandListRow>>;
} {
  const entries = createBrandsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is BrandFieldCatalogEntry & { filterConfig: ListViewColumnFilterConfig<BrandListRow> } =>
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
