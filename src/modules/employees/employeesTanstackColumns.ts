import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "@/shared/i18n";
import type {
  EmployeeAccessStatus,
  EmployeeAvailabilityKind,
  EmployeeRecordStatus,
} from "./model";
import type { EmployeeListRow } from "./employeeListRowModel";
import type { EmployeesTableColumnSchema } from "./employeesTableSchema";
import {
  translateDepartmentCode,
  translateEmployeeAccessStatus,
  translateEmployeeAvailabilityKind,
  translateEmployeeRecordStatus,
  translatePositionCode,
  translateSystemRoleCode,
} from "./employeeListLabels";

type ColumnMeta = {
  align?: "left" | "right" | "center";
};

type BuildEmployeesTanstackColumnsInput = {
  schema: EmployeesTableColumnSchema[];
  t: TFunction;
};

const columnHelper = createColumnHelper<EmployeeListRow>();

function emDashLabel(t: TFunction): string {
  return t("domain.audit.summary.emDash");
}

function formatLastLogin(value: unknown, t: TFunction): string {
  const em = emDashLabel(t);
  if (value == null || value === "") return em;
  if (typeof value !== "string") return em;
  return value.replace("T", " ").slice(0, 19);
}

export function formatEmployeesTableValue(input: {
  column: EmployeesTableColumnSchema;
  value: unknown;
  t: TFunction;
  rowIndex?: number;
}): string {
  const { column, value, t, rowIndex } = input;
  const em = emDashLabel(t);

  if (column.id === "lineNo") return String((rowIndex ?? 0) + 1);

  if (column.id === "status" && typeof value === "string") {
    return translateEmployeeRecordStatus(t, value as EmployeeRecordStatus);
  }
  if (column.id === "accessStatus" && typeof value === "string") {
    return translateEmployeeAccessStatus(t, value as EmployeeAccessStatus);
  }
  if (column.id === "availabilityKind" && typeof value === "string") {
    return translateEmployeeAvailabilityKind(t, value as EmployeeAvailabilityKind);
  }
  if (column.id === "primaryRoleCode" && typeof value === "string") {
    return translateSystemRoleCode(t, value);
  }
  if (column.id === "positionCode" && typeof value === "string") {
    return translatePositionCode(t, value);
  }
  if (column.id === "departmentCode" && typeof value === "string") {
    return translateDepartmentCode(t, value);
  }
  if (column.id === "lastLoginAt") {
    return formatLastLogin(value, t);
  }
  if (column.id === "managerDisplay") {
    if (value == null || value === "") return em;
    return String(value);
  }

  if (value == null) return "";
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function getColumnAlign(column: EmployeesTableColumnSchema): ColumnMeta["align"] {
  if (column.id === "lineNo") return "right";
  if (column.rendererType === "numeric") return "right";
  return "left";
}

export function buildEmployeesTanstackColumns(
  input: BuildEmployeesTanstackColumnsInput,
): ColumnDef<EmployeeListRow, unknown>[] {
  const { schema, t } = input;

  return schema.map((column) => {
    const meta: ColumnMeta = {
      align: getColumnAlign(column),
    };

    if (column.id === "lineNo") {
      return columnHelper.display({
        id: column.id,
        header: column.label,
        cell: (ctx) =>
          formatEmployeesTableValue({
            column,
            value: ctx.row.index + 1,
            t,
            rowIndex: ctx.row.index,
          }),
        enableSorting: false,
        enableHiding: false,
        size: column.defaultSize,
        minSize: column.minSize,
        maxSize: column.maxSize,
        meta,
      });
    }

    return columnHelper.accessor((row): unknown => row[column.accessorKey ?? "employeeCode"], {
      id: column.id,
      header: column.label,
      cell: (ctx) =>
        formatEmployeesTableValue({
          column,
          value: ctx.getValue() as unknown,
          t,
          rowIndex: ctx.row.index,
        }),
      enableSorting: column.sortable,
      enableHiding: !column.lockedVisible,
      size: column.defaultSize,
      minSize: column.minSize,
      maxSize: column.maxSize,
      meta,
    });
  });
}
