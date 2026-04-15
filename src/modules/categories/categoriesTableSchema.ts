import type { TFunction } from "@/shared/i18n";
import type { ListViewFieldDataType } from "@/shared/ui/ag-grid/listViewConfig";
import type {
  ListViewFieldSourceType,
  ListViewPerformanceCost,
  ListViewRendererType,
} from "@/shared/ui/ag-grid/listViewConfig/types";
import type { CategoryListRow } from "./categoryListRowModel";

export type CategoriesTableFilterKind = "text" | "boolean" | "none";
export type CategoriesTableFormatKind = "none" | "yes-no";

export type CategoriesTableColumnSchema = {
  id: string;
  label: string;
  accessorKey?: keyof CategoryListRow;
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
  filterKind: CategoriesTableFilterKind;
  formatKind?: CategoriesTableFormatKind;
  cellDataType?: boolean;
};

type BuildCategoriesTableSchemaInput = {
  t: TFunction;
};

export function buildCategoriesTableSchema(input: BuildCategoriesTableSchemaInput): CategoriesTableColumnSchema[] {
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
      minSize: 160,
      defaultFlex: 1,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
    },
    {
      id: "comment",
      label: t("doc.columns.comment"),
      accessorKey: "comment",
      dataType: "string",
      sourceType: "document",
      defaultVisible: true,
      lockedVisible: false,
      sortable: true,
      filterable: true,
      exportable: true,
      selectable: true,
      minSize: 160,
      rendererType: "text",
      performanceCost: "low",
      filterKind: "text",
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
