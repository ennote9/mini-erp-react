import type { Employee } from "@/modules/employees/model";
import type { Item, ItemResponsibleAssignment, ItemResponsibleRoleCode } from "../model";

/** Fixed v1 role list — order matches UI table. */
export const ITEM_RESPONSIBLE_ROLE_CODES: readonly ItemResponsibleRoleCode[] = [
  "content_manager",
  "category_manager",
  "brand_manager",
  "buyer",
  "sales_manager",
  "operations_owner",
] as const;

export type EmployeeDisplaySlice = {
  id: string;
  displayName: string;
  positionDepartment: string;
  recordStatusLabelKey: "active" | "inactive" | "other";
  availabilityKind: Employee["availability"]["kind"];
  substituteEmployeeId: string | null;
};

export type DirectAssignmentRowModel = {
  roleCode: ItemResponsibleRoleCode;
  assignment: ItemResponsibleAssignment | null;
  employee: Employee | undefined;
  display: EmployeeDisplaySlice | null;
};

function positionDepartmentLine(e: Employee): string {
  const pos = e.identity.positionCode.trim();
  const dep = e.identity.departmentCode.trim();
  if (pos && dep) return `${dep} · ${pos}`;
  return pos || dep || "—";
}

export function buildEmployeeDisplaySlice(e: Employee): EmployeeDisplaySlice {
  const st = e.identity.status;
  const recordStatusLabelKey =
    st === "active" ? "active" : st === "inactive" ? "inactive" : "other";
  return {
    id: e.id,
    displayName: e.identity.displayName.trim() || e.identity.fullName.trim() || e.identity.employeeCode,
    positionDepartment: positionDepartmentLine(e),
    recordStatusLabelKey,
    availabilityKind: e.availability.kind,
    substituteEmployeeId: e.availability.substituteEmployeeId,
  };
}

export function isEmployeeOperationallyUnavailable(e: Employee): boolean {
  if (e.identity.status !== "active") return true;
  return e.availability.kind !== "active";
}

/** Employee has an assignment scope row matching the item brand (for picker hints). */
export function employeeLinkedToItemBrandScope(employee: Employee, brandId: string | undefined): boolean {
  if (!brandId) return false;
  return employee.org.assignmentScopes.some((s) => s.kind === "brand" && s.entityId === brandId);
}

/** Employee has an assignment scope row matching the item category (for picker hints). */
export function employeeLinkedToItemCategoryScope(employee: Employee, categoryId: string | undefined): boolean {
  if (!categoryId) return false;
  return employee.org.assignmentScopes.some((s) => s.kind === "category" && s.entityId === categoryId);
}

export function buildDirectAssignmentRows(item: Item): DirectAssignmentRowModel[] {
  const list = item.responsibleAssignments ?? [];
  const byRole = new Map<ItemResponsibleRoleCode, ItemResponsibleAssignment>();
  for (const a of list) {
    if (!byRole.has(a.roleCode)) byRole.set(a.roleCode, a);
  }
  return ITEM_RESPONSIBLE_ROLE_CODES.map((roleCode) => {
    const assignment = byRole.get(roleCode) ?? null;
    return {
      roleCode,
      assignment,
      employee: undefined,
      display: null,
    };
  });
}

/** Attach employee entities to rows (call after loading employees). */
export function attachEmployeesToDirectRows(
  rows: DirectAssignmentRowModel[],
  employeesById: Map<string, Employee>,
): DirectAssignmentRowModel[] {
  return rows.map((row) => {
    const empId = row.assignment?.employeeId;
    const employee = empId ? employeesById.get(empId) : undefined;
    const display = employee ? buildEmployeeDisplaySlice(employee) : null;
    return { ...row, employee, display };
  });
}
