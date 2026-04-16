import type { TFunction } from "@/shared/i18n";
import type { BarcodeRegistryRow } from "./barcodeRegistryReadModel";
import type { ListViewFieldDataType } from "@/shared/ui/ag-grid/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/ag-grid/listViewConfig/types";

export type BarcodeRegistryTableFilterKind =
  | "text"
  | "boolean"
  | "enum"
  | "datetime"
  | "none";

export type BarcodeRegistryTableFormatKind =
  | "none"
  | "yes-no"
  | "optional-text"
  | "entry-type"
  | "source"
  | "symbology"
  | "markdown-status";

export type BarcodeRegistryTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof BarcodeRegistryRow;
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
  filterKind: BarcodeRegistryTableFilterKind;
  formatKind?: BarcodeRegistryTableFormatKind;
  cellDataType?: boolean;
};

type BuildBarcodeRegistryTableSchemaInput = {
  t: TFunction;
};

export function buildBarcodeRegistryTableSchema(
  input: BuildBarcodeRegistryTableSchemaInput,
): BarcodeRegistryTableColumnSchema[] {
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
      label: t("exportExcel.list.colCode"),
      accessorKey: "code",
      dataType: "identifier",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 190,
      minSize: 170,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "entryType",
      label: t("exportExcel.list.colEntryType"),
      accessorKey: "entryType",
      dataType: "enum",
      sourceType: "derived",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 160,
      minSize: 140,
      rendererType: "status-badge",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "entry-type",
    },
    {
      id: "itemCode",
      label: t("exportExcel.list.colItemCode"),
      accessorKey: "itemCode",
      dataType: "identifier",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      minSize: 120,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "itemName",
      label: t("exportExcel.list.colItemName"),
      accessorKey: "itemName",
      dataType: "reference",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      minSize: 220,
      defaultFlex: 1,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "isActive",
      label: t("exportExcel.list.colActive"),
      accessorKey: "isActive",
      dataType: "boolean",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 120,
      minSize: 110,
      rendererType: "boolean-badge",
      performanceCost: "low",
      filterKind: "boolean",
      formatKind: "yes-no",
      cellDataType: false,
    },
    {
      id: "source",
      label: t("exportExcel.list.colSource"),
      accessorKey: "source",
      dataType: "enum",
      sourceType: "derived",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 150,
      minSize: 130,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "source",
    },
    {
      id: "createdAt",
      label: t("exportExcel.list.colCreated"),
      accessorKey: "createdAt",
      dataType: "datetime",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 180,
      minSize: 160,
      rendererType: "date",
      performanceCost: "low",
      filterKind: "datetime",
      formatKind: "optional-text",
    },
    {
      id: "symbology",
      label: t("exportExcel.list.colSymbology"),
      accessorKey: "symbology",
      dataType: "enum",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 150,
      minSize: 130,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "symbology",
    },
    {
      id: "markdownJournalNumber",
      label: t("exportExcel.list.colMarkdownJournal"),
      accessorKey: "markdownJournalNumber",
      dataType: "identifier",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 150,
      minSize: 130,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
      formatKind: "optional-text",
    },
    {
      id: "markdownStatus",
      label: t("exportExcel.list.colRecordStatus"),
      accessorKey: "markdownStatus",
      dataType: "enum",
      sourceType: "lookup",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      defaultSize: 140,
      minSize: 120,
      rendererType: "status-badge",
      performanceCost: "low",
      filterKind: "enum",
      formatKind: "markdown-status",
    },
  ];
}
