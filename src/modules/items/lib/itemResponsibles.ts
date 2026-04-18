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

export type RelatedContextRowModel = {
  employee: Employee;
  display: EmployeeDisplaySlice;
  scopeKind: "brand" | "category";
  scopeLabel: string;
  businessRoleLabels: string[];
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

function scopeMatches(
  emp: Employee,
  kind: "brand" | "category",
  entityId: string | undefined,
): boolean {
  if (!entityId) return false;
  return emp.org.assignmentScopes.some((s) => s.kind === kind && s.entityId === entityId);
}

function businessRoleLabels(emp: Employee): string[] {
  const roles = emp.businessRoles?.assignedRoles ?? [];
  const out: string[] = [];
  for (const r of roles) {
    const desc = r.description.trim();
    out.push(desc ? `${r.roleCode} — ${desc}` : r.roleCode);
  }
  return out.length > 0 ? out : ["—"];
}

/**
 * Employees with a brand scope matching the item brand (unique by employee id).
 */
export function buildRelatedByBrandRows(
  item: Item,
  employees: Employee[],
  brandLabel: string | undefined,
): RelatedContextRowModel[] {
  const bid = item.brandId;
  if (!bid) return [];
  const seen = new Set<string>();
  const out: RelatedContextRowModel[] = [];
  for (const emp of employees) {
    if (!scopeMatches(emp, "brand", bid)) continue;
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);
    out.push({
      employee: emp,
      display: buildEmployeeDisplaySlice(emp),
      scopeKind: "brand",
      scopeLabel: brandLabel ?? bid,
      businessRoleLabels: businessRoleLabels(emp),
    });
  }
  return out;
}

/**
 * Employees with a category scope matching the item category (unique by employee id).
 */
export function buildRelatedByCategoryRows(
  item: Item,
  employees: Employee[],
  categoryLabel: string | undefined,
): RelatedContextRowModel[] {
  const cid = item.categoryId;
  if (!cid) return [];
  const seen = new Set<string>();
  const out: RelatedContextRowModel[] = [];
  for (const emp of employees) {
    if (!scopeMatches(emp, "category", cid)) continue;
    if (seen.has(emp.id)) continue;
    seen.add(emp.id);
    out.push({
      employee: emp,
      display: buildEmployeeDisplaySlice(emp),
      scopeKind: "category",
      scopeLabel: categoryLabel ?? cid,
      businessRoleLabels: businessRoleLabels(emp),
    });
  }
  return out;
}

export type ResponsiblesSummaryCounts = {
  directFilled: number;
  relatedBrand: number;
  relatedCategory: number;
  unavailableDirect: number;
};

export function computeResponsiblesSummary(
  directRows: DirectAssignmentRowModel[],
  relatedBrand: RelatedContextRowModel[],
  relatedCategory: RelatedContextRowModel[],
): ResponsiblesSummaryCounts {
  const directFilled = directRows.filter((r) => r.assignment != null).length;
  let unavailableDirect = 0;
  for (const r of directRows) {
    if (!r.assignment || !r.employee) continue;
    if (isEmployeeOperationallyUnavailable(r.employee)) unavailableDirect += 1;
  }
  return {
    directFilled,
    relatedBrand: relatedBrand.length,
    relatedCategory: relatedCategory.length,
    unavailableDirect,
  };
}
