import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type { AgGridColumnFilterConfig, ListViewFieldRegistryEntry } from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { CategoryListRow } from "./categoryListRowModel";
import {
  buildCategoriesTableSchema,
  type CategoriesTableColumnSchema,
} from "./categoriesTableSchema";

type CategoryFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<CategoryListRow>;
  filterConfig?: AgGridColumnFilterConfig<CategoryListRow>;
};

type BuildCategoriesFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function mapSchemaToRegistry(column: CategoriesTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "categories",
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
  column: CategoriesTableColumnSchema,
): AgGridColumnFilterConfig<CategoryListRow> | undefined {
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
  column: CategoriesTableColumnSchema,
  input: BuildCategoriesFieldCatalogInput,
): ListColumnDef<CategoryListRow> {
  const { t, formatMoney } = input;
  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(t);
  }

  const colDef: ListColumnDef<CategoryListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof CategoryListRow & string,
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

function createCategoriesFieldCatalog(input: BuildCategoriesFieldCatalogInput): CategoryFieldCatalogEntry[] {
  const schema = buildCategoriesTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column),
  }));
}

export function buildCategoriesListViewCatalog(input: BuildCategoriesFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<CategoryListRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<CategoryListRow>>;
} {
  const entries = createCategoriesFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is CategoryFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<CategoryListRow> } =>
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
