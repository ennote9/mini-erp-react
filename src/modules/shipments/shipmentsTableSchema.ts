import type { TFunction } from "@/shared/i18n";
import type { ShipmentListRow } from "./shipmentListRowModel";
import type { ListViewFieldDataType } from "@/shared/ui/list-view/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/list-view/listViewConfig/types";

export type ShipmentsTableFilterKind = "text" | "date" | "enum" | "none";
export type ShipmentsTableFormatKind = "none" | "shipment-date" | "factual-status";

export type ShipmentsTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof ShipmentListRow;
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
  filterKind: ShipmentsTableFilterKind;
  formatKind?: ShipmentsTableFormatKind;
  cellDataType?: boolean;
};

type BuildShipmentsTableSchemaInput = {
  t: TFunction;
};

export function buildShipmentsTableSchema(input: BuildShipmentsTableSchemaInput): ShipmentsTableColumnSchema[] {
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
      formatKind: "shipment-date",
    },
    {
      id: "salesOrderNumber",
      label: t("doc.columns.salesOrder"),
      accessorKey: "salesOrderNumber",
      dataType: "identifier",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 200,
      minSize: 180,
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
      id: "carrierLabel",
      label: t("doc.shipment.carrier"),
      accessorKey: "carrierLabel",
      dataType: "reference",
      sourceType: "derived",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 160,
      minSize: 140,
      maxSize: 220,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "trackingLabel",
      label: t("doc.shipment.trackingNumber"),
      accessorKey: "trackingLabel",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 220,
      minSize: 160,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "recipientLabel",
      label: t("doc.shipment.recipientName"),
      accessorKey: "recipientLabel",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      minSize: 130,
      maxSize: 200,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "recipientPhoneLabel",
      label: t("doc.shipment.recipientPhone"),
      accessorKey: "recipientPhoneLabel",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 130,
      minSize: 120,
      maxSize: 160,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "deliveryAddressPreview",
      label: t("doc.shipment.deliveryAddress"),
      accessorKey: "deliveryAddressPreview",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      minSize: 120,
      maxSize: 200,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
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
