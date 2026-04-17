import type { Employee, EmployeeRecordStatus } from "./model";
import { employeeRepository } from "./repository";

export type EmployeeListRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  displayName: string;
  status: EmployeeRecordStatus;
  positionCode: string;
  departmentCode: string;
  managerDisplay: string;
};

function managerDisplayForEmployee(e: Employee): string {
  const mid = e.identity.directManagerId;
  if (!mid) return "";
  const m = employeeRepository.getById(mid);
  return m ? m.identity.displayName || m.identity.fullName : mid;
}

export function buildEmployeeListRows(employees: Employee[]): EmployeeListRow[] {
  return employees.map((e) => ({
    id: e.id,
    employeeCode: e.identity.employeeCode,
    fullName: e.identity.fullName,
    displayName: e.identity.displayName,
    status: e.identity.status,
    positionCode: e.identity.positionCode,
    departmentCode: e.identity.departmentCode,
    managerDisplay: managerDisplayForEmployee(e),
  }));
}
