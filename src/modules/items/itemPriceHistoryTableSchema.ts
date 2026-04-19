import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType, ListViewFieldSourceType, ListViewRendererType } from "@/shared/ui/list-view/listViewConfig/types";

export type ItemPriceHistoryColumnSchema = {
  id: string;
  label: string;
  dataType: ListViewFieldDataType;
  sourceType: ListViewFieldSourceType;
  sortable: boolean;
  filterable: boolean;
  /** Baseline width for TanStack column sizing. */
  defaultSize: number;
  /** Soft minimum used when fitting into the card; extra width goes to high flexWeight columns first. */
  minSize: number;
  maxSize?: number;
  align: "left" | "right" | "center";
  rendererType: ListViewRendererType;
  /**
   * Relative share of *additional* width after soft minimums (comment + reason absorb most).
   * Not equal to pixel width — only ratios matter.
   */
  flexWeight: number;
};

/**
 * Width model: baseline column sizes for TanStack resizing; wider reason/comment absorb space.
 * Scroll is vertical in the table area; horizontal scroll appears when total column width exceeds the container.
 */
export function buildItemPriceHistoryTableSchema(t: TFunction): ItemPriceHistoryColumnSchema[] {
  return [
    {
      id: "priceType",
      label: t("master.item.prices.colType"),
      dataType: "enum",
      sourceType: "document",
      sortable: true,
      filterable: true,
      defaultSize: 88,
      minSize: 76,
      flexWeight: 1,
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
      defaultSize: 88,
      minSize: 76,
      flexWeight: 1,
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
      defaultSize: 120,
      minSize: 100,
      flexWeight: 1.15,
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
      defaultSize: 120,
      minSize: 100,
      flexWeight: 1.15,
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
      defaultSize: 118,
      minSize: 100,
      flexWeight: 1.75,
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
      defaultSize: 200,
      minSize: 120,
      flexWeight: 3.5,
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
      defaultSize: 280,
      minSize: 100,
      flexWeight: 6,
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
      minSize: 118,
      flexWeight: 1.35,
      align: "left",
      rendererType: "date",
    },
  ];
}
