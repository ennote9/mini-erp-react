import type { ListColumnDef } from "@/shared/ui/list-view/listColumnDef";
import type { TFunction } from "@/shared/i18n";
import type {
  ListViewColumnFilterConfig,
  ListViewColumnFilterOption,
  ListViewFieldRegistryEntry,
} from "@/shared/ui/list-view";
import { getListViewRowNumberColumnDef } from "@/shared/ui/list-view/listViewColumnDefaults";
import type { EmployeeListRow } from "./employeeListRowModel";
import {
  translateDepartmentCode,
  translateEmployeeGender,
  translateEmployeeIdentityDocumentType,
  translateEmployeeRecordStatus,
  translateEmploymentType,
  translatePositionCode,
  translateWorkSchedule,
} from "./employeeListLabels";
import {
  EMPLOYEE_GENDERS,
  EMPLOYEE_IDENTITY_DOCUMENT_TYPES,
  EMPLOYEE_LIST_EMPLOYMENT_TYPES,
  EMPLOYEE_LIST_WORK_SCHEDULES,
  EMPLOYEE_RECORD_STATUSES,
} from "./employeeListConstants";
import { buildEmployeesTableSchema, type EmployeesTableColumnSchema } from "./employeesTableSchema";
import type { EmployeeEmploymentType, EmployeeGender, EmployeeIdentityDocumentType, EmployeeWorkSchedule } from "./model";

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
    case "date":
      return { kind: "date" };
    case "enum": {
      const ef = column.enumField;
      if (ef === "status") {
        return {
          kind: "enum",
          options: buildEnumOptions(t, EMPLOYEE_RECORD_STATUSES, (tf, v) =>
            translateEmployeeRecordStatus(tf, v as (typeof EMPLOYEE_RECORD_STATUSES)[number]),
          ),
        };
      }
      if (ef === "gender") {
        return {
          kind: "enum",
          options: buildEnumOptions(t, EMPLOYEE_GENDERS, (tf, v) =>
            translateEmployeeGender(tf, v as EmployeeGender),
          ),
        };
      }
      if (ef === "documentType") {
        return {
          kind: "enum",
          options: buildEnumOptions(t, EMPLOYEE_IDENTITY_DOCUMENT_TYPES, (tf, v) =>
            translateEmployeeIdentityDocumentType(tf, v as EmployeeIdentityDocumentType),
          ),
        };
      }
      if (ef === "employmentType") {
        return {
          kind: "enum",
          options: buildEnumOptions(t, EMPLOYEE_LIST_EMPLOYMENT_TYPES, (tf, v) =>
            translateEmploymentType(tf, v as EmployeeEmploymentType),
          ),
        };
      }
      if (ef === "workSchedule") {
        return {
          kind: "enum",
          options: buildEnumOptions(t, EMPLOYEE_LIST_WORK_SCHEDULES, (tf, v) =>
            translateWorkSchedule(tf, v as EmployeeWorkSchedule),
          ),
        };
      }
      return { kind: "enum", options: [] };
    }
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
  if (column.id === "employmentType") {
    colDef.valueGetter = (p) => (p.data ? translateEmploymentType(t, p.data.employmentType) : "");
  }
  if (column.id === "workSchedule") {
    colDef.valueGetter = (p) => (p.data ? translateWorkSchedule(t, p.data.workSchedule) : "");
  }
  if (column.id === "gender") {
    colDef.valueGetter = (p) => (p.data ? translateEmployeeGender(t, p.data.gender) : "");
  }
  if (column.id === "documentType") {
    colDef.valueGetter = (p) =>
      p.data ? translateEmployeeIdentityDocumentType(t, p.data.documentType) : "";
  }
  if (column.id === "managerDisplay" || column.id === "functionalManagerDisplay") {
    colDef.valueGetter = (p) => {
      const v = column.id === "managerDisplay" ? p.data?.managerDisplay : p.data?.functionalManagerDisplay;
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
