import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type { ListViewColumnFilterConfig, ListViewFieldRegistryEntry } from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import type { SupplierListRow } from "./supplierListRowModel";
import {
  buildSuppliersTableSchema,
  type SuppliersTableColumnSchema,
} from "./suppliersTableSchema";

type SupplierFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<SupplierListRow>;
  filterConfig?: ListViewColumnFilterConfig<SupplierListRow>;
};

type BuildSuppliersFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function mapSchemaToRegistry(column: SuppliersTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "suppliers",
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
  column: SuppliersTableColumnSchema,
): ListViewColumnFilterConfig<SupplierListRow> | undefined {
  if (!column.filterable) return undefined;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: SuppliersTableColumnSchema,
  input: BuildSuppliersFieldCatalogInput,
): ListColumnDef<SupplierListRow> {
  const { t, formatMoney } = input;
  const emDash = t("domain.audit.summary.emDash");

  if (column.id === "lineNo") {
    return getListViewRowNumberColumnDef(t);
  }

  const colDef: ListColumnDef<SupplierListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof SupplierListRow & string,
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

  if (column.formatKind === "payment-terms-days") {
    colDef.valueFormatter = (params) =>
      params.value != null && typeof params.value === "number"
        ? t("doc.summary.paymentTermsDays", { days: params.value })
        : emDash;
  }

  void formatMoney;
  return colDef;
}

function createSuppliersFieldCatalog(input: BuildSuppliersFieldCatalogInput): SupplierFieldCatalogEntry[] {
  const schema = buildSuppliersTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column),
  }));
}

export function buildSuppliersListViewCatalog(input: BuildSuppliersFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<SupplierListRow>[];
  filterConfigs: Record<string, ListViewColumnFilterConfig<SupplierListRow>>;
} {
  const entries = createSuppliersFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is SupplierFieldCatalogEntry & { filterConfig: ListViewColumnFilterConfig<SupplierListRow> } =>
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
