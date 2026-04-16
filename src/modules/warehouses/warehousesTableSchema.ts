import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType } from "@/shared/ui/ag-grid/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/ag-grid/listViewConfig/types";
import type { WarehouseListRow } from "./warehouseListRowModel";

export type WarehousesTableFilterKind = "text" | "number" | "boolean" | "enum" | "none";
export type WarehousesTableFormatKind = "none" | "yes-no" | "optional-text";

export type WarehousesTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof WarehouseListRow;
  dataType: ListViewFieldDataType;
  sourceType: ListViewFieldSourceType;
  defaultVisible: boolean;
  lockedVisible: boolean;
  sortable: boolean;
  filterable: boolean;
  exportable: boolean;
  selectable: boolean;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  defaultFlex?: number;
  rendererType: ListViewRendererType;
  performanceCost: ListViewPerformanceCost;
  filterKind: WarehousesTableFilterKind;
  formatKind?: WarehousesTableFormatKind;
  cellDataType?: boolean;
};

type BuildWarehousesTableSchemaInput = {
  t: TFunction;
};

export function buildWarehousesTableSchema(input: BuildWarehousesTableSchemaInput): WarehousesTableColumnSchema[] {
  const { t } = input;
  return [
    {
      id: "lineNo",
      label: t("doc.columns.lineNo"),
      dataType: "identifier",
      sourceType: "system",
      defaultVisible: true,
      lockedVisible: true,
      sortable: false,
      filterable: false,
      exportable: true,
      selectable: true,
      defaultSize: 56,
      minSize: 56,
      maxSize: 56,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "none",
    },
    {
      id: "code",
      label: t("doc.columns.code"),
      accessorKey: "code",
      dataType: "identifier",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "name",
      label: t("doc.columns.name"),
      accessorKey: "name",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      minSize: 180,
      defaultFlex: 1,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "warehouseType",
      label: t("doc.columns.warehouseType"),
      accessorKey: "warehouseType",
      dataType: "enum",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 120,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "optional-text",
    },
    {
      id: "city",
      label: t("doc.columns.city"),
      accessorKey: "city",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "contactPerson",
      label: t("doc.columns.contactPerson"),
      accessorKey: "contactPerson",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 150,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "phone",
      label: t("doc.columns.phone"),
      accessorKey: "phone",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "isActive",
      label: t("doc.columns.active"),
      accessorKey: "isActive",
      dataType: "boolean",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 110,
      minSize: 96,
      rendererType: "boolean-badge",
      performanceCost: "low",
      filterKind: "boolean",
      formatKind: "yes-no",
      cellDataType: false,
    },
  ];
}
