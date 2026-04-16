import type { TFunction } from "@/shared/i18n";
import type { StockMovementListRow } from "./movementListRowModel";
import type { ListViewFieldDataType } from "@/shared/ui/list-view/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/list-view/listViewConfig/types";

export type MovementsTableFilterKind = "text" | "enum" | "number" | "datetime" | "none";
export type MovementsTableFormatKind =
  | "none"
  | "movement-datetime"
  | "movement-type-label"
  | "qty-delta"
  | "plain";

export type MovementsTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof StockMovementListRow;
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
  rendererType: ListViewRendererType;
  performanceCost: ListViewPerformanceCost;
  filterKind: MovementsTableFilterKind;
  formatKind?: MovementsTableFormatKind;
  cellDataType?: boolean;
};

type BuildMovementsTableSchemaInput = {
  t: TFunction;
};

export function buildMovementsTableSchema(input: BuildMovementsTableSchemaInput): MovementsTableColumnSchema[] {
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
      id: "datetime",
      label: t("doc.columns.dateTime"),
      accessorKey: "datetime",
      dataType: "datetime",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 200,
      minSize: 160,
      maxSize: 280,
      rendererType: "date",
      performanceCost: "low",
      filterKind: "datetime",
      formatKind: "movement-datetime",
    },
    {
      id: "movementType",
      label: t("doc.columns.movementType"),
      accessorKey: "movementType",
      dataType: "enum",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 120,
      minSize: 100,
      maxSize: 200,
      rendererType: "status-badge",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "movement-type-label",
    },
    {
      id: "itemCode",
      label: t("doc.columns.itemCode"),
      accessorKey: "itemCode",
      dataType: "identifier",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 120,
      minSize: 100,
      maxSize: 200,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "plain",
    },
    {
      id: "itemName",
      label: t("doc.columns.itemName"),
      accessorKey: "itemName",
      dataType: "string",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 200,
      minSize: 160,
      maxSize: 560,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "plain",
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
      defaultSize: 140,
      minSize: 120,
      maxSize: 280,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "plain",
    },
    {
      id: "qtyDelta",
      label: t("doc.columns.qtyDelta"),
      accessorKey: "qtyDelta",
      dataType: "number",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 110,
      minSize: 96,
      maxSize: 160,
      rendererType: "numeric",
      performanceCost: "low",
      filterKind: "number",
      formatKind: "qty-delta",
      cellDataType: true,
    },
    {
      id: "sourceDocumentLabel",
      label: t("doc.columns.sourceDocument"),
      accessorKey: "sourceDocumentLabel",
      dataType: "identifier",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 148,
      minSize: 132,
      maxSize: 280,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "plain",
    },
    {
      id: "relatedOrder",
      label: t("doc.columns.relatedOrder"),
      accessorKey: "relatedOrderLabel",
      dataType: "identifier",
      sourceType: "derived",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 132,
      minSize: 120,
      maxSize: 240,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "plain",
    },
  ];
}
