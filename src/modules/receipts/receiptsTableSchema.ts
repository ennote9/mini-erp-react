import type { TFunction } from "@/shared/i18n";
import type { ReceiptListRow } from "./receiptListRowModel";
import type { ListViewFieldDataType } from "@/shared/ui/list-view/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/list-view/listViewConfig/types";

export type ReceiptsTableFilterKind = "text" | "date" | "enum" | "none";
export type ReceiptsTableFormatKind = "none" | "receipt-date" | "factual-status";

export type ReceiptsTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof ReceiptListRow;
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
  filterKind: ReceiptsTableFilterKind;
  formatKind?: ReceiptsTableFormatKind;
  cellDataType?: boolean;
};

type BuildReceiptsTableSchemaInput = {
  t: TFunction;
};

export function buildReceiptsTableSchema(input: BuildReceiptsTableSchemaInput): ReceiptsTableColumnSchema[] {
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
      id: "number",
      label: t("doc.columns.number"),
      accessorKey: "number",
      dataType: "identifier",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 150,
      minSize: 120,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "date",
      label: t("doc.columns.date"),
      accessorKey: "date",
      dataType: "date",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      minSize: 120,
      rendererType: "date",
      performanceCost: "low",
      filterKind: "date",
      formatKind: "receipt-date",
    },
    {
      id: "purchaseOrderNumber",
      label: t("doc.columns.purchaseOrder"),
      accessorKey: "purchaseOrderNumber",
      dataType: "identifier",
      sourceType: "lookup",
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
      id: "warehouseName",
      label: t("doc.columns.warehouse"),
      accessorKey: "warehouseName",
      dataType: "reference",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 160,
      minSize: 140,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "enum",
    },
    {
      id: "status",
      label: t("doc.columns.status"),
      accessorKey: "status",
      dataType: "enum",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 130,
      minSize: 110,
      rendererType: "status-badge",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "factual-status",
    },
  ];
}
