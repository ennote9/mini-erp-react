import { employeeRepository } from "@/modules/employees/repository";
import { itemRepository, flushPendingItemsPersist } from "./repository";
import type { ItemResponsibleAssignment, ItemResponsibleRoleCode } from "./model";
import { ITEM_RESPONSIBLE_ROLE_CODES } from "./lib/itemResponsibles";

function newAssignmentId(): string {
  return `ra-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type UpsertResponsibleInput = {
  roleCode: ItemResponsibleRoleCode;
  employeeId: string;
  note: string;
  assignedByEmployeeId: string | null;
};

export type ResponsibleMutationResult = { success: true } | { success: false; error: string };

function validateRole(roleCode: ItemResponsibleRoleCode): string | null {
  if (!ITEM_RESPONSIBLE_ROLE_CODES.includes(roleCode)) return "Invalid responsibility role.";
  return null;
}

export function upsertItemResponsibleAssignment(
  itemId: string,
  input: UpsertResponsibleInput,
): ResponsibleMutationResult {
  const roleErr = validateRole(input.roleCode);
  if (roleErr) return { success: false, error: roleErr };
  const empId = input.employeeId.trim();
  if (!empId) return { success: false, error: "Employee is required." };
  const emp = employeeRepository.getById(empId);
  if (!emp) return { success: false, error: "Employee not found." };

  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };

  const prev = item.responsibleAssignments ?? [];
  const filtered = prev.filter((a) => a.roleCode !== input.roleCode);
  const next: ItemResponsibleAssignment = {
    id: newAssignmentId(),
    roleCode: input.roleCode,
    employeeId: empId,
    note: input.note.trim(),
    assignedAt: new Date().toISOString(),
    assignedByEmployeeId: input.assignedByEmployeeId,
  };
  itemRepository.update(itemId, { responsibleAssignments: [...filtered, next] });
  return { success: true };
}

export async function upsertItemResponsibleAssignmentAwaitPersist(
  itemId: string,
  input: UpsertResponsibleInput,
): Promise<ResponsibleMutationResult> {
  const r = upsertItemResponsibleAssignment(itemId, input);
  if (!r.success) return r;
  try {
    await flushPendingItemsPersist();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg || "persist_failed" };
  }
  return { success: true };
}

export function removeItemResponsibleAssignment(
  itemId: string,
  roleCode: ItemResponsibleRoleCode,
): ResponsibleMutationResult {
  const roleErr = validateRole(roleCode);
  if (roleErr) return { success: false, error: roleErr };
  const item = itemRepository.getById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const prev = item.responsibleAssignments ?? [];
  const next = prev.filter((a) => a.roleCode !== roleCode);
  if (next.length === prev.length) return { success: false, error: "Assignment not found." };
  itemRepository.update(itemId, { responsibleAssignments: next });
  return { success: true };
}

export async function removeItemResponsibleAssignmentAwaitPersist(
  itemId: string,
  roleCode: ItemResponsibleRoleCode,
): Promise<ResponsibleMutationResult> {
  const r = removeItemResponsibleAssignment(itemId, roleCode);
  if (!r.success) return r;
  try {
    await flushPendingItemsPersist();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg || "persist_failed" };
  }
  return { success: true };
}
