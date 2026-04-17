import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  ListViewColumnFilterConfig,
  ListViewColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import type { EmployeeListRow } from "./employeeListRowModel";
import { translateDepartmentCode, translateEmployeeRecordStatus, translatePositionCode } from "./employeeListLabels";
import { EMPLOYEE_RECORD_STATUSES } from "./employeeListConstants";
import { buildEmployeesTableSchema, type EmployeesTableColumnSchema } from "./employeesTableSchema";

type EmployeeFieldCatalogEntry = {
  registry: ListViewFieldRegistryEntry;
  colDef: ListColumnDef<EmployeeListRow>;
  filterConfig?: ListViewColumnFilterConfig<EmployeeListRow>;
};

type BuildEmployeesFieldCatalogInput = {
  t: TFunction;
  formatMoney: (value: number, fractionDigits?: number, currencyCode?: string) => string;
};

function buildEnumOptions(t: TFunction, values: readonly string[], translate: (t: TFunction, v: string) => string) {
  const opts: ListViewColumnFilterOption[] = values.map((v) => ({
    value: v,
    label: translate(t, v),
  }));
  return opts.sort((a, b) => a.label.localeCompare(b.label));
}

function mapSchemaToRegistry(column: EmployeesTableColumnSchema): ListViewFieldRegistryEntry {
  return {
    fieldKey: column.id,
    entityType: "employees",
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

function mapSchemaToFilterConfig(
  column: EmployeesTableColumnSchema,
  input: BuildEmployeesFieldCatalogInput,
): ListViewColumnFilterConfig<EmployeeListRow> | undefined {
  if (!column.filterable) return undefined;
  const { t } = input;

  switch (column.filterKind) {
    case "text":
      return { kind: "text" };
    case "boolean":
      return { kind: "boolean" };
    case "enum":
      if (column.id === "status") {
        const options = buildEnumOptions(t, EMPLOYEE_RECORD_STATUSES, (tf, v) =>
          translateEmployeeRecordStatus(tf, v as (typeof EMPLOYEE_RECORD_STATUSES)[number]),
        );
        return {
          kind: "enum",
          options,
          getValue: (row) => translateEmployeeRecordStatus(t, row.status),
        };
      }
      return { kind: "enum", options: [] };
    case "none":
    default:
      return undefined;
  }
}

function buildColDefFromSchema(
  column: EmployeesTableColumnSchema,
  input: BuildEmployeesFieldCatalogInput,
): ListColumnDef<EmployeeListRow> {
  const { t, formatMoney } = input;
  const emDash = t("domain.audit.summary.emDash");

  if (column.id === "lineNo") {
    return getListViewRowNumberColumnDef(t);
  }

  const colDef: ListColumnDef<EmployeeListRow> = {
    colId: column.id,
    headerName: column.label,
    sortable: column.sortable,
    field: (column.accessorKey ?? column.id) as keyof EmployeeListRow & string,
  };

  if (column.id === "positionCode") {
    colDef.valueGetter = (p) => (p.data ? translatePositionCode(t, p.data.positionCode) : "");
  }
  if (column.id === "departmentCode") {
    colDef.valueGetter = (p) => (p.data ? translateDepartmentCode(t, p.data.departmentCode) : "");
  }
  if (column.id === "status") {
    colDef.valueGetter = (p) => (p.data ? translateEmployeeRecordStatus(t, p.data.status) : "");
  }
  if (column.id === "managerDisplay") {
    colDef.valueGetter = (p) => {
      const v = p.data?.managerDisplay;
      if (v == null || v === "") return emDash;
      return String(v);
    };
  }

  if (column.defaultSize != null) colDef.initialWidth = column.defaultSize;
  if (column.defaultFlex != null) colDef.initialFlex = column.defaultFlex;
  if (!column.defaultVisible) colDef.initialHide = true;
  if (column.minSize != null) colDef.minWidth = column.minSize;
  if (column.maxSize != null) colDef.maxWidth = column.maxSize;

  void formatMoney;
  return colDef;
}

function createEmployeesFieldCatalog(input: BuildEmployeesFieldCatalogInput): EmployeeFieldCatalogEntry[] {
  const schema = buildEmployeesTableSchema({ t: input.t });
  return schema.map((column) => ({
    registry: mapSchemaToRegistry(column),
    colDef: buildColDefFromSchema(column, input),
    filterConfig: mapSchemaToFilterConfig(column, input),
  }));
}

export function buildEmployeesListViewCatalog(input: BuildEmployeesFieldCatalogInput): {
  fieldRegistry: ListViewFieldRegistryEntry[];
  columnDefs: ListColumnDef<EmployeeListRow>[];
  filterConfigs: Record<string, ListViewColumnFilterConfig<EmployeeListRow>>;
} {
  const entries = createEmployeesFieldCatalog(input);
  const filterConfigs = Object.fromEntries(
    entries
      .filter(
        (entry): entry is EmployeeFieldCatalogEntry & { filterConfig: ListViewColumnFilterConfig<EmployeeListRow> } =>
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
