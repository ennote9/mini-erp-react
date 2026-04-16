import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  ListViewColumnFilterConfig,
  ListViewColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import { normalizeDateForPO } from "./dateUtils";
import type { PurchaseOrderListRow } from "./purchaseOrderListRowModel";
import {
  buildPurchaseOrdersTableSchema,
  type PurchaseOrdersTableColumnSchema,
} from "./purchaseOrdersTableSchema";

type PurchaseOrdersFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<PurchaseOrderListRow>;
  filterConfig?: ListViewColumnFilterConfig<PurchaseOrderListRow>;
};

export type BuildPurchaseOrdersListViewCatalogInput = {
  t: TFunction;
  formatDate: (value: string | null | undefined, options?: { empty?: string }) => string;
  supplierNameEnumOptions: ListViewColumnFilterOption[];
  warehouseNameEnumOptions: ListViewColumnFilterOption[];
  statusEnumOptions: ListViewColumnFilterOption[];
};

function mapSchemaToRegistry(column: PurchaseOrdersTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "purchase-orders",
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
  column: PurchaseOrdersTableColumnSchema,
  input: BuildPurchaseOrdersListViewCatalogInput,
): ListViewColumnFilterConfig<PurchaseOrderListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "date":
      return { kind: "date" };
    case "enum":
      if (column.id === "supplierName") {
        return {
          kind: "enum",
          options: input.supplierNameEnumOptions,
          getValue: (row) => row.supplierName,
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
  column: PurchaseOrdersTableColumnSchema,
  input: BuildPurchaseOrdersListViewCatalogInput,
): ListColumnDef<PurchaseOrderListRow> {
  const { t, formatDate } = input;

  if (column.id === "lineNo") {
    return getListViewRowNumberColumnDef(t);
  }

  const colDef: ListColumnDef<PurchaseOrderListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof PurchaseOrderListRow & string,
  };

  if (column.id === "date") {
    colDef.valueFormatter = (params) => {
      const raw = params.value == null ? undefined : String(params.value);
      return formatDate(normalizeDateForPO(raw), { empty: "" });
    };
  }

  if (column.id === "status") {
    colDef.valueFormatter = (params) => {
      const v = params.value as string | undefined;
      if (v == null || v === "") return "";
      return t(`status.labels.${v}`);
    };
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;

  return colDef;
}

function createPurchaseOrdersFieldCatalog(
  input: BuildPurchaseOrdersListViewCatalogInput,
): PurchaseOrdersFieldCatalogEntry[] {
  const schema = buildPurchaseOrdersTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildPurchaseOrdersListViewCatalog(input: BuildPurchaseOrdersListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<PurchaseOrderListRow>[];
  filterConfigs: Record<string, ListViewColumnFilterConfig<PurchaseOrderListRow>>;
} {
  const entries = createPurchaseOrdersFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (
          entry,
        ): entry is PurchaseOrdersFieldCatalogEntry & {
          filterConfig: ListViewColumnFilterConfig<PurchaseOrderListRow>;
        } => Boolean(entry.filterConfig),
      )
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );

  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}
