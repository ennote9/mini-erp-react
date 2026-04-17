import type { TFunction } from "@/shared/i18n";
import type { EmployeeRecordStatus } from "./model";

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
