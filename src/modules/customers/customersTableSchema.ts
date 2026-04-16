import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType } from "@/shared/ui/list-view/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/list-view/listViewConfig/types";
import type { CustomerListRow } from "./customerListRowModel";

export type CustomersTableFilterKind = "text" | "number" | "boolean" | "none";
export type CustomersTableFormatKind = "none" | "yes-no" | "optional-text" | "payment-terms-days";

export type CustomersTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof CustomerListRow;
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
  filterKind: CustomersTableFilterKind;
  formatKind?: CustomersTableFormatKind;
  cellDataType?: boolean;
};

type BuildCustomersTableSchemaInput = {
  t: TFunction;
};

export function buildCustomersTableSchema(input: BuildCustomersTableSchemaInput): CustomersTableColumnSchema[] {
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
      defaultSize: 140,
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
      defaultSize: 150,
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
      minSize: 180,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
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
      defaultSize: 120,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "paymentTermsDays",
      label: t("doc.columns.paymentTerms"),
      accessorKey: "paymentTermsDays",
      dataType: "number",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 120,
      minSize: 100,
      rendererType: "numeric",
      performanceCost: "low",
      filterKind: "number",
      formatKind: "payment-terms-days",
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
