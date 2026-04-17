import type { Employee } from "./model";
import type { Issue } from "@/shared/issues";

export function getEmployeeDocumentHealth(employee: Employee): { issues: Issue[] } {
  const issues: Issue[] = [];
  const code = employee.identity.employeeCode.trim();
  const name = employee.identity.fullName.trim();

  if (!code) {
    issues.push({
      severity: "error",
      scope: "field",
      code: "employee.codeRequired",
      message: "Employee code is required",
      i18nKey: "employees.validation.codeRequired",
      field: "identity.employeeCode",
    });
  }
  if (!name) {
    issues.push({
      severity: "error",
      scope: "field",
      code: "employee.fullNameRequired",
      message: "Full name is required",
      i18nKey: "employees.validation.fullNameRequired",
      field: "identity.fullName",
    });
  }

  const end = employee.identity.employmentEndDate;
  const start = employee.identity.employmentStartDate;
  if (end && start && end < start) {
    issues.push({
      severity: "error",
      scope: "document",
      code: "employee.endBeforeStart",
      message: "Employment end date is before start date",
      i18nKey: "employees.validation.endBeforeStart",
    });
  }

  return { issues };
}
