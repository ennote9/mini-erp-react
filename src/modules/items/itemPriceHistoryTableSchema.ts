import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType, ListViewFieldSourceType, ListViewRendererType } from "@/shared/ui/list-view/listViewConfig/types";

export type ItemPriceHistoryColumnSchema = {
  id: string;
  label: string;
  dataType: ListViewFieldDataType;
  sourceType: ListViewFieldSourceType;
  sortable: boolean;
  filterable: boolean;
  defaultSize: number;
  minSize: number;
  maxSize?: number;
  align: "left" | "right" | "center";
  rendererType: ListViewRendererType;
};

export function buildItemPriceHistoryTableSchema(t: TFunction): ItemPriceHistoryColumnSchema[] {
  return [
    {
      id: "priceType",
      label: t("master.item.prices.colType"),
      dataType: "enum",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 100,
      minSize: 80,
      align: "left",
      rendererType: "text",
    },
    {
      id: "amount",
      label: t("master.item.prices.colAmount"),
      dataType: "money",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 110,
      minSize: 88,
      align: "right",
      rendererType: "numeric",
    },
    {
      id: "validFrom",
      label: t("master.item.prices.colValidFrom"),
      dataType: "date",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 104,
      minSize: 88,
      align: "left",
      rendererType: "date",
    },
    {
      id: "validTo",
      label: t("master.item.prices.colValidTo"),
      dataType: "date",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 104,
      minSize: 88,
      align: "left",
      rendererType: "date",
    },
    {
      id: "status",
      label: t("master.item.prices.colStatus"),
      dataType: "enum",
      sourceType: "derived",
      sortable: true,
      filterable: true,
      defaultSize: 120,
      minSize: 96,
      align: "left",
      rendererType: "status-badge",
    },
    {
      id: "reasonCode",
      label: t("master.item.prices.colReason"),
      dataType: "enum",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 140,
      minSize: 100,
      align: "left",
      rendererType: "text",
    },
    {
      id: "comment",
      label: t("master.item.prices.colComment"),
      dataType: "string",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 180,
      minSize: 120,
      align: "left",
      rendererType: "text",
    },
    {
      id: "createdAt",
      label: t("master.item.prices.colCreated"),
      dataType: "datetime",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 132,
      minSize: 112,
      align: "left",
      rendererType: "date",
    },
    {
      id: "actions",
      label: t("master.item.prices.colActions"),
      dataType: "identifier",
      sourceType: "system",
      sortable: false,
      filterable: false,
      defaultSize: 76,
      minSize: 72,
      maxSize: 96,
      align: "right",
      rendererType: "text",
    },
  ];
}
