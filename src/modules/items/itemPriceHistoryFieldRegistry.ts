import type { TFunction } from "@/shared/i18n";
import type { ListViewColumnFilterConfig } from "@/shared/ui/list-view";
import type { ListViewFieldRegistryEntry } from "@/shared/ui/list-view/listViewConfig";
import type { ItemPriceReasonCode } from "./model";
import type { PriceHistoryRow } from "./lib/itemPriceHistory";
import { buildItemPriceHistoryTableSchema, type ItemPriceHistoryColumnSchema } from "./itemPriceHistoryTableSchema";

const REASON_CODES: ItemPriceReasonCode[] = [
  "initial_migration",
  "manual_update",
  "supplier_change",
  "commercial_review",
  "correction",
  "other",
];

export function buildItemPriceHistoryFieldRegistry(t: TFunction): ListViewFieldRegistryEntry[] {
  const schema = buildItemPriceHistoryTableSchema(t);
  return schema
    .filter((col) => col.id !== "actions")
    .map((column) => mapSchemaToRegistryEntry(column));
}

function mapSchemaToRegistryEntry(column: ItemPriceHistoryColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "item-price-history",
    label: column.label,
    dataType: column.dataType,
    sourceType: column.sourceType,
    defaultVisible: true,
    lockedVisible: false,
    sortable: column.sortable,
    filterable: column.filterable,
    exportable: false,
    selectable: false,
    rendererType: column.rendererType,
    requiresPermission: null,
    performanceCost: "low",
  };
}

export function buildItemPriceHistoryFilterConfigs(
  t: TFunction,
): Record<string, ListViewColumnFilterConfig<PriceHistoryRow>> {
  const priceTypeOptions = [
    { value: "purchase", label: t("master.item.prices.typePurchase") },
    { value: "sale", label: t("master.item.prices.typeSale") },
  ];
  const statusOptions = [
    { value: "active", label: t("master.item.prices.statusActive") },
    { value: "scheduled", label: t("master.item.prices.statusScheduled") },
    { value: "superseded", label: t("master.item.prices.statusSuperseded") },
    { value: "cancelled", label: t("master.item.prices.statusCancelled") },
  ];
  const reasonOptions = REASON_CODES.map((code) => ({
    value: code,
    label: t(`master.item.prices.reason_${code}` as "master.item.prices.reason_manual_update"),
  }));

  const configs: Record<string, ListViewColumnFilterConfig<PriceHistoryRow>> = {
    priceType: {
      kind: "enum",
      options: priceTypeOptions,
      getValue: (row) => row.priceType,
    },
    amount: {
      kind: "number",
      getValue: (row) => row.amount,
    },
    validFrom: {
      kind: "date",
      getValue: (row) => row.validFrom,
    },
    validTo: {
      kind: "date",
      getValue: (row) => row.validTo ?? "",
    },
    status: {
      kind: "enum",
      options: statusOptions,
      getValue: (row) => row.status,
    },
    reasonCode: {
      kind: "enum",
      options: reasonOptions,
      getValue: (row) => row.reasonCode,
    },
    comment: {
      kind: "text",
      getValue: (row) => row.comment ?? "",
    },
    createdAt: {
      kind: "datetime",
      getValue: (row) => row.createdAt,
    },
  };

  return configs;
}
