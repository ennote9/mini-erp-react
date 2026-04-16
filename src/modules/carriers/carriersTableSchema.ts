import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType } from "@/shared/ui/ag-grid/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/ag-grid/listViewConfig/types";
import type { CarrierListRow } from "./carrierListRowModel";

export type CarriersTableFilterKind = "text" | "number" | "boolean" | "enum" | "none";
export type CarriersTableFormatKind = "none" | "yes-no" | "optional-text" | "carrier-type";

export type CarriersTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof CarrierListRow;
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
  filterKind: CarriersTableFilterKind;
  formatKind?: CarriersTableFormatKind;
  cellDataType?: boolean;
};

type BuildCarriersTableSchemaInput = {
  t: TFunction;
};

export function buildCarriersTableSchema(input: BuildCarriersTableSchemaInput): CarriersTableColumnSchema[] {
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
      defaultSize: 130,
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
      minSize: 160,
      defaultFlex: 1,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "carrierType",
      label: t("doc.columns.carrierType"),
      accessorKey: "carrierType",
      dataType: "enum",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 160,
      rendererType: "status-badge",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "carrier-type",
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
      defaultSize: 130,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "email",
      label: t("doc.columns.email"),
      accessorKey: "email",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 160,
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
