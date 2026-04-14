import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { TFunction } from "@/shared/i18n";
import type { AgGridColumnFilterConfig, ListViewFieldRegistryEntry } from "@/shared/ui/ag-grid";
import { AgGridActiveBooleanCellRenderer } from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import type { ItemListRow } from "./listViewRowModel";

type ItemFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ColDef<ItemListRow>;
  filterConfig?: AgGridColumnFilterConfig<ItemListRow>;
};

type BuildItemsFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function CountCellRenderer(params: ICellRendererParams<ItemListRow, number>) {
  const n = typeof params.value === "number" ? params.value : 0;
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }
  return <span className="tabular-nums text-foreground/90">{n}</span>;
}

function createItemsFieldCatalog(input: BuildItemsFieldCatalogInput): ItemFieldCatalogEntry[] {
  const { t, formatMoney } = input;
  const yesLabel = t("common.yes");
  const noLabel = t("common.no");
  return [
    {
      registry: {
        fieldKey: "lineNo",
        entityType: "items",
        label: t("doc.columns.lineNo"),
        dataType: "identifier",
        sourceType: "system",
        defaultVisible: true,
        lockedVisible: true,
        sortable: false,
        filterable: false,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: getAgGridRowNumberColDef(t),
    },
    {
      registry: {
        fieldKey: "code",
        entityType: "items",
        label: t("doc.columns.code"),
        dataType: "identifier",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "code",
        headerName: t("doc.columns.code"),
        width: 130,
      },
      filterConfig: { kind: "text" },
    },
    {
      registry: {
        fieldKey: "itemKind",
        entityType: "items",
        label: t("master.item.list.kindColumn"),
        dataType: "enum",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "itemKind",
        headerName: t("master.item.list.kindColumn"),
        width: 100,
        maxWidth: 120,
        valueGetter: (params) => params.data?.itemKind ?? "SELLABLE",
        valueFormatter: (params) =>
          params.value === "TESTER" ? t("master.item.kind.tester") : t("master.item.kind.sellable"),
      },
      filterConfig: {
        kind: "enum",
        getValue: (item) => item.itemKind ?? "SELLABLE",
        options: [
          { value: "SELLABLE", label: t("master.item.kind.sellable") },
          { value: "TESTER", label: t("master.item.kind.tester") },
        ],
      },
    },
    {
      registry: {
        fieldKey: "name",
        entityType: "items",
        label: t("doc.columns.name"),
        dataType: "string",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "name",
        headerName: t("doc.columns.name"),
        minWidth: 160,
        flex: 1,
      },
      filterConfig: { kind: "text" },
    },
    {
      registry: {
        fieldKey: "imageCount",
        entityType: "items",
        label: t("doc.columns.images"),
        dataType: "number",
        sourceType: "derived",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "numeric",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "imageCount",
        headerName: t("doc.columns.images"),
        width: 76,
        maxWidth: 88,
        field: "imageCount",
        cellRenderer: CountCellRenderer,
      },
      filterConfig: {
        kind: "number",
      },
    },
    {
      registry: {
        fieldKey: "hasImages",
        entityType: "items",
        label: t("doc.columns.hasImages"),
        dataType: "boolean",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "boolean-badge",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "hasImages",
        headerName: t("doc.columns.hasImages"),
        width: 120,
        field: "hasImages",
        valueFormatter: (params) => (params.value ? yesLabel : noLabel),
      },
      filterConfig: {
        kind: "boolean",
      },
    },
    {
      registry: {
        fieldKey: "brand",
        entityType: "items",
        label: t("doc.columns.brand"),
        dataType: "reference",
        sourceType: "lookup",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "brand",
        headerName: t("doc.columns.brand"),
        width: 110,
        field: "brand",
      },
      filterConfig: {
        kind: "enum",
        getValue: (item) => item.brandName,
        options: brandRepository.list().map((brand) => ({ value: brand.name, label: brand.name })),
      },
    },
    {
      registry: {
        fieldKey: "category",
        entityType: "items",
        label: t("doc.columns.category"),
        dataType: "reference",
        sourceType: "lookup",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "category",
        headerName: t("doc.columns.category"),
        width: 120,
        field: "category",
      },
      filterConfig: {
        kind: "enum",
        getValue: (item) => item.categoryName,
        options: categoryRepository.list().map((category) => ({ value: category.name, label: category.name })),
      },
    },
    {
      registry: {
        fieldKey: "uom",
        entityType: "items",
        label: t("doc.columns.uom"),
        dataType: "string",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "uom",
        headerName: t("doc.columns.uom"),
        width: 90,
      },
      filterConfig: { kind: "text" },
    },
    {
      registry: {
        fieldKey: "purchasePrice",
        entityType: "items",
        label: t("doc.columns.purchasePrice"),
        dataType: "money",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "numeric",
        requiresPermission: null,
        performanceCost: "medium",
      },
      colDef: {
        field: "purchasePrice",
        headerName: t("doc.columns.purchasePrice"),
        width: 120,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number" ? formatMoney(params.value, 2, "") : "",
      },
      filterConfig: { kind: "number" },
    },
    {
      registry: {
        fieldKey: "salePrice",
        entityType: "items",
        label: t("doc.columns.salePrice"),
        dataType: "money",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "numeric",
        requiresPermission: null,
        performanceCost: "medium",
      },
      colDef: {
        field: "salePrice",
        headerName: t("doc.columns.salePrice"),
        width: 100,
        valueFormatter: (params) =>
          params.value != null && typeof params.value === "number" ? formatMoney(params.value, 2, "") : "",
      },
      filterConfig: { kind: "number" },
    },
    {
      registry: {
        fieldKey: "isActive",
        entityType: "items",
        label: t("doc.columns.active"),
        dataType: "boolean",
        sourceType: "document",
        defaultVisible: true,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "boolean-badge",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "isActive",
        headerName: t("doc.columns.active"),
        width: 100,
        cellRenderer: AgGridActiveBooleanCellRenderer,
      },
      filterConfig: { kind: "boolean" },
    },
    {
      registry: {
        fieldKey: "description",
        entityType: "items",
        label: t("common.description"),
        dataType: "string",
        sourceType: "document",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "description",
        headerName: t("common.description"),
        minWidth: 180,
        width: 220,
        hide: true,
      },
      filterConfig: { kind: "text" },
    },
    {
      registry: {
        fieldKey: "barcode",
        entityType: "items",
        label: t("doc.columns.primaryBarcode"),
        dataType: "identifier",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "barcode",
        headerName: t("doc.columns.primaryBarcode"),
        width: 150,
        hide: true,
      },
      filterConfig: {
        kind: "text",
      },
    },
    {
      registry: {
        fieldKey: "barcodeCount",
        entityType: "items",
        label: t("doc.columns.barcodeCount"),
        dataType: "number",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "numeric",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "barcodeCount",
        headerName: t("doc.columns.barcodeCount"),
        width: 120,
        field: "barcodeCount",
        cellRenderer: CountCellRenderer,
        hide: true,
      },
      filterConfig: {
        kind: "number",
      },
    },
    {
      registry: {
        fieldKey: "hasBarcode",
        entityType: "items",
        label: t("doc.columns.hasBarcode"),
        dataType: "boolean",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "boolean-badge",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        colId: "hasBarcode",
        headerName: t("doc.columns.hasBarcode"),
        width: 110,
        field: "hasBarcode",
        valueFormatter: (params) => (params.value ? yesLabel : noLabel),
        hide: true,
      },
      filterConfig: {
        kind: "boolean",
      },
    },
    {
      registry: {
        fieldKey: "accountingProfile",
        entityType: "items",
        label: t("master.item.accountingProfile"),
        dataType: "string",
        sourceType: "document",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "text",
        requiresPermission: null,
        performanceCost: "low",
      },
      colDef: {
        field: "accountingProfile",
        headerName: t("master.item.accountingProfile"),
        width: 170,
        hide: true,
      },
      filterConfig: { kind: "text" },
    },
    {
      registry: {
        fieldKey: "testerCount",
        entityType: "items",
        label: t("doc.columns.testerCount"),
        dataType: "number",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "numeric",
        requiresPermission: null,
        performanceCost: "low",
      },
            colDef: {
              colId: "testerCount",
              headerName: t("doc.columns.testerCount"),
              width: 120,
              field: "testerCount",
              cellRenderer: CountCellRenderer,
              hide: true,
            },
            filterConfig: {
              kind: "number",
            },
          },
    {
      registry: {
        fieldKey: "hasTesters",
        entityType: "items",
        label: t("doc.columns.hasTesters"),
        dataType: "boolean",
        sourceType: "derived",
        defaultVisible: false,
        lockedVisible: false,
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: true,
        rendererType: "boolean-badge",
        requiresPermission: null,
        performanceCost: "low",
      },
            colDef: {
              colId: "hasTesters",
              headerName: t("doc.columns.hasTesters"),
              width: 120,
              field: "hasTesters",
              valueFormatter: (params) => (params.value ? yesLabel : noLabel),
              hide: true,
            },
            filterConfig: {
              kind: "boolean",
            },
          },
  ];
}

export function buildItemsListViewCatalog(input: BuildItemsFieldCatalogInput): {
  columnDefs: ColDef<ItemListRow>[];
  fieldRegistry: ListViewFieldRegistryEntry[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<ItemListRow>>;
} {
  const catalog = createItemsFieldCatalog(input);
  const filterConfigs: Record<string, AgGridColumnFilterConfig<ItemListRow>> = {};
  for (const entry of catalog) {
    if (entry.filterConfig) {
      filterConfigs[entry.registry.fieldKey] = entry.filterConfig;
    }
  }
  return {
    columnDefs: catalog.map((entry) => entry.colDef),
    fieldRegistry: catalog.map((entry) => entry.registry),
    filterConfigs,
  };
}
