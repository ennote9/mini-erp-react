import type { TFunction } from "@/shared/i18n";
import type { EmployeeEmploymentType, EmployeeRecordStatus, EmployeeWorkSchedule } from "./model";

export function translateEmployeeRecordStatus(t: TFunction, v: EmployeeRecordStatus): string {
  return t(`employees.enums.recordStatus.${v}`);
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

export function translateEmploymentType(t: TFunction, v: EmployeeEmploymentType): string {
  return t(`employees.enums.employmentType.${v}`);
}

export function translateWorkSchedule(t: TFunction, v: EmployeeWorkSchedule): string {
  return t(`employees.enums.workSchedule.${v}`);
}
