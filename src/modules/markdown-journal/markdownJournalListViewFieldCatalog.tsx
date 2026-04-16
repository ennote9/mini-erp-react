import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  AgGridColumnFilterConfig,
  AgGridColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/ag-grid";
import { getAgGridRowNumberColDef } from "@/shared/ui/ag-grid/agGridDefaults";
import type { MarkdownJournalStatus } from "./model";
import { MARKDOWN_JOURNAL_STATUS_FILTERS } from "./pageConfig";
import type { JournalRow, MarkdownCodeRow } from "./markdownJournalListRowModel";
import {
  buildMarkdownCodesTableSchema,
  buildMarkdownJournalsTableSchema,
  type MarkdownJournalTanstackColumnSchema,
} from "./markdownJournalTableSchema";

function journalStatusLabel(status: MarkdownJournalStatus, t: TFunction): string {
  switch (status) {
    case "draft":
      return t("status.factual.draft");
    case "posted":
      return t("status.factual.posted");
    case "cancelled":
      return t("status.factual.cancelled");
    default:
      return status;
  }
}

type JournalsFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<JournalRow>;
  filterConfig?: AgGridColumnFilterConfig<JournalRow>;
};

type CodesFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<MarkdownCodeRow>;
  filterConfig?: AgGridColumnFilterConfig<MarkdownCodeRow>;
};

export type BuildMarkdownJournalsListViewCatalogInput = {
  t: TFunction;
  journalRows: JournalRow[];
};

export type BuildMarkdownCodesListViewCatalogInput = {
  t: TFunction;
  codeRows: MarkdownCodeRow[];
};

function mapJournalsSchemaToRegistry(column: MarkdownJournalTanstackColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "markdown-journal-journals",
    label: column.label,
    dataType: column.dataType,
    sourceType: column.sourceType,
    defaultVisible: column.defaultVisible,
    lockedVisible: column.lockedVisible,
    sortable: column.sortable,
    filterable: column.filterable,
    exportable: column.exportable,
    selectable: column.selectable,
    rendererType: column.rendererType,
    requiresPermission: null,
    performanceCost: column.performanceCost,
  };
}

function mapCodesSchemaToRegistry(column: MarkdownJournalTanstackColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "markdown-journal-codes",
    label: column.label,
    dataType: column.dataType,
    sourceType: column.sourceType,
    defaultVisible: column.defaultVisible,
    lockedVisible: column.lockedVisible,
    sortable: column.sortable,
    filterable: column.filterable,
    exportable: column.exportable,
    selectable: column.selectable,
    rendererType: column.rendererType,
    requiresPermission: null,
    performanceCost: column.performanceCost,
  };
}

function mapJournalsFilterConfig(
  column: MarkdownJournalTanstackColumnSchema,
  input: BuildMarkdownJournalsListViewCatalogInput,
): AgGridColumnFilterConfig<JournalRow> | undefined {
  if (!column.filterable) return undefined;
  const { t, journalRows } = input;
  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "datetime":
      return { kind: "datetime" };
    case "enum":
      if (column.id === "status") {
        return {
          kind: "enum",
          options: MARKDOWN_JOURNAL_STATUS_FILTERS.filter(
            (value): value is MarkdownJournalStatus => value !== "all",
          ).map((value) => ({ value, label: journalStatusLabel(value, t) })),
        };
      }
      if (column.id === "sourceWarehouseLabel") {
        return {
          kind: "enum",
          options: Array.from(new Set(journalRows.map((row) => row.sourceWarehouseLabel)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value })),
        };
      }
      if (column.id === "targetWarehouseLabel") {
        return {
          kind: "enum",
          options: Array.from(new Set(journalRows.map((row) => row.targetWarehouseLabel)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value })),
        };
      }
      return { kind: "enum", options: [] satisfies AgGridColumnFilterOption[] };
    case "none":
    default:
      return undefined;
  }
}

function mapCodesFilterConfig(
  column: MarkdownJournalTanstackColumnSchema,
  input: BuildMarkdownCodesListViewCatalogInput,
): AgGridColumnFilterConfig<MarkdownCodeRow> | undefined {
  if (!column.filterable) return undefined;
  const { codeRows } = input;
  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "datetime":
      return { kind: "datetime" };
    case "enum":
      if (column.id === "warehouseLabel") {
        return {
          kind: "enum",
          options: Array.from(new Set(codeRows.map((row) => row.warehouseLabel)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value })),
        };
      }
      if (column.id === "statusLabel") {
        return {
          kind: "enum",
          options: Array.from(new Set(codeRows.map((row) => row.statusLabel)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value })),
        };
      }
      if (column.id === "reasonLabel") {
        return {
          kind: "enum",
          options: Array.from(new Set(codeRows.map((row) => row.reasonLabel)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value })),
        };
      }
      return { kind: "enum", options: [] satisfies AgGridColumnFilterOption[] };
    case "none":
    default:
      return undefined;
  }
}

function buildJournalsColDefFromSchema(
  column: MarkdownJournalTanstackColumnSchema,
  input: BuildMarkdownJournalsListViewCatalogInput,
): ListColumnDef<JournalRow> {
  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(input.t);
  }
  const fieldKey = (column.accessorKey ?? column.id) as keyof JournalRow & string;
  const colDef: ListColumnDef<JournalRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: fieldKey,
  };
  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;
  return colDef;
}

function buildCodesColDefFromSchema(column: MarkdownJournalTanstackColumnSchema, input: BuildMarkdownCodesListViewCatalogInput): ListColumnDef<MarkdownCodeRow> {
  if (column.id === "lineNo") {
    return getAgGridRowNumberColDef(input.t);
  }
  const fieldKey = (column.accessorKey ?? column.id) as keyof MarkdownCodeRow & string;
  const colDef: ListColumnDef<MarkdownCodeRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: fieldKey,
  };
  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;
  if (column.cellDataType != null) colDef.cellDataType = column.cellDataType;
  return colDef;
}

function createJournalsFieldCatalog(input: BuildMarkdownJournalsListViewCatalogInput): JournalsFieldCatalogEntry[] {
  const schema = buildMarkdownJournalsTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapJournalsSchemaToRegistry(column),
    colDef: buildJournalsColDefFromSchema(column, input),
    filterConfig: mapJournalsFilterConfig(column, input),
  }));
}

function createCodesFieldCatalog(input: BuildMarkdownCodesListViewCatalogInput): CodesFieldCatalogEntry[] {
  const schema = buildMarkdownCodesTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapCodesSchemaToRegistry(column),
    colDef: buildCodesColDefFromSchema(column, input),
    filterConfig: mapCodesFilterConfig(column, input),
  }));
}

export function buildMarkdownJournalsListViewCatalog(input: BuildMarkdownJournalsListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<JournalRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<JournalRow>>;
} {
  const entries = createJournalsFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is JournalsFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<JournalRow> } =>
          Boolean(entry.filterConfig),
      )
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );
  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}

export function buildMarkdownCodesListViewCatalog(input: BuildMarkdownCodesListViewCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<MarkdownCodeRow>[];
  filterConfigs: Record<string, AgGridColumnFilterConfig<MarkdownCodeRow>>;
} {
  const entries = createCodesFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is CodesFieldCatalogEntry & { filterConfig: AgGridColumnFilterConfig<MarkdownCodeRow> } =>
          Boolean(entry.filterConfig),
      )
      .map((entry) => [entry.registry.fieldKey, entry.filterConfig]),
  );
  return {
    fieldRegistry: entries.map((entry) => entry.registry),
    columnDefs: entries.map((entry) => entry.colDef),
    filterConfigs,
  };
}
