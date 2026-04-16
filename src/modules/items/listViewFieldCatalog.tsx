import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type { ListViewColumnFilterConfig, ListViewFieldRegistryEntry } from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import type { ItemListRow } from "./listViewRowModel";
import {
  buildItemsTableSchema,
  type ItemsTableColumnSchema,
  type ItemsTableOption,
} from "./itemsTableSchema";

type ItemFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<ItemListRow>;
  filterConfig?: ListViewColumnFilterConfig<ItemListRow>;
};

type BuildItemsFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function mapSchemaToRegistry(column: ItemsTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "items",
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

function mapSchemaOptions(options: ItemsTableOption[] | undefined) {
  return (options ?? []).map((option) => ({ value: option.value, label: option.label }));
}

function mapSchemaToFilterConfig(column: ItemsTableColumnSchema): ListViewColumnFilterConfig<ItemListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "enum":
      return {
        kind: "enum",
        options: mapSchemaOptions(column.enumOptions),
      };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: ItemsTableColumnSchema,
  input: BuildItemsFieldCatalogInput,
): ListColumnDef<ItemListRow> {
  const { t, formatMoney } = input;
  if (column.id === "lineNo") {
    return getListViewRowNumberColumnDef(t);
  }

  const colDef: ListColumnDef<ItemListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as any,
  };

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  if (column.formatKind === "money") {
    colDef.valueFormatter = (params) =>
      params.value != null && typeof params.value === "number" ? formatMoney(params.value, 2, "") : "";
  }

  if (column.formatKind === "yes-no") {
    const yesLabel = t("common.yes");
    const noLabel = t("common.no");
    colDef.valueFormatter = (params) => (params.value ? yesLabel : noLabel);
  }

  if (column.formatKind === "item-kind") {
    colDef.valueFormatter = (params) =>
      params.value === "TESTER" ? t("master.item.kind.tester") : t("master.item.kind.sellable");
  }

  return colDef;
}

function createItemsFieldCatalog(input: BuildItemsFieldCatalogInput): ItemFieldCatalogEntry[] {
  const schema = buildItemsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column),
  }));
}

export function buildItemsListViewCatalog(input: BuildItemsFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<ItemListRow>[];
  filterConfigs: Record<string, ListViewColumnFilterConfig<ItemListRow>>;
} {
  const entries = createItemsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter((entry): entry is ItemFieldCatalogEntry & { filterConfig: ListViewColumnFilterConfig<ItemListRow> } => Boolean(entry.filterConfig))
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );

  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}
