import type { TFunction } from "@/shared/i18n";
import type { EmployeeAccessStatus, EmployeeAvailabilityKind, EmployeeRecordStatus } from "./model";

export function translateEmployeeRecordStatus(t: TFunction, v: EmployeeRecordStatus): string {
  return t(`employees.enums.recordStatus.${v}`);
}

export function translateEmployeeAccessStatus(t: TFunction, v: EmployeeAccessStatus): string {
  return t(`employees.enums.accessStatus.${v}`);
}

export function translateEmployeeAvailabilityKind(t: TFunction, v: EmployeeAvailabilityKind): string {
  return t(`employees.enums.availability.${v}`);
}

export function translateDepartmentCode(t: TFunction, code: string): string {
  const k = `employees.dict.department.${code}`;
  const resolved = t(k);
  return resolved === k ? code : resolved;
}

export function translatePositionCode(t: TFunction, code: string): string {
  const k = `employees.dict.position.${code}`;
  const resolved = t(k);
  return resolved === k ? code : resolved;
}

export function translateSystemRoleCode(t: TFunction, code: string): string {
  const k = `employees.dict.systemRole.${code}`;
  const resolved = t(k);
  return resolved === k ? code : resolved;
}
