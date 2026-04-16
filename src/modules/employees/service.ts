import type { Employee, EmployeeAuditEvent } from "./model";
import { emptyEmployeeShell } from "./defaults";

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function newAuditId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Blank record for `/employees/new` — caller assigns `id` after create. */
export function createBlankEmployee(): Employee {
  const shell = emptyEmployeeShell();
  return {
    ...shell,
    id: "",
    identity: {
      ...shell.identity,
      employmentStartDate: todayYmd(),
    },
    org: {
      ...shell.org,
      departmentCode: shell.identity.departmentCode,
      positionCode: shell.identity.positionCode,
      directManagerId: shell.identity.directManagerId,
    },
    access: {
      ...shell.access,
      primaryRoleCode: shell.identity.primarySystemRoleCode,
    },
  };
}

/** Keep identity summary fields aligned with canonical nested slices (still stored separately in JSON). */
export function normalizeEmployeeForSave(e: Employee): Employee {
  const identity = {
    ...e.identity,
    primarySystemRoleCode: e.access.primaryRoleCode,
    departmentCode: e.org.departmentCode,
    positionCode: e.org.positionCode,
    directManagerId: e.org.directManagerId,
  };
  return {
    ...e,
    identity,
  };
}

export function buildAuditEventsForSave(prev: Employee | null, next: Employee, actorLabel: string): EmployeeAuditEvent[] {
  const at = new Date().toISOString();
  const out: EmployeeAuditEvent[] = [];
  const push = (kind: EmployeeAuditEvent["kind"], summary: string, details?: string) => {
    out.push({
      id: newAuditId(),
      at,
      actorEmployeeId: null,
      actorLabel,
      kind,
      summary,
      details,
    });
  };

  if (!prev) {
    push("created", "Employee record created");
    return out;
  }

  if (prev.identity.positionCode !== next.identity.positionCode) {
    push("position_changed", `${prev.identity.positionCode} → ${next.identity.positionCode}`);
  }
  if (prev.identity.departmentCode !== next.identity.departmentCode) {
    push("department_changed", `${prev.identity.departmentCode} → ${next.identity.departmentCode}`);
  }
  if (prev.identity.status !== next.identity.status) {
    push("status_changed", `${prev.identity.status} → ${next.identity.status}`);
  }
  if (prev.access.primaryRoleCode !== next.access.primaryRoleCode || prev.access.additionalRoleCodes.join() !== next.access.additionalRoleCodes.join()) {
    push("roles_changed", "System roles updated");
  }
  if (
    prev.access.permissionGroupCode !== next.access.permissionGroupCode ||
    prev.access.financeVisibility !== next.access.financeVisibility ||
    prev.access.canApprove !== next.access.canApprove
  ) {
    push("permissions_changed", "Permission profile updated");
  }
  if (prev.access.accessStatus !== next.access.accessStatus) {
    if (next.access.accessStatus === "blocked") push("access_block", "Access blocked");
    else if (prev.access.accessStatus === "blocked" && next.access.accessStatus === "active") {
      push("access_unblock", "Access unblocked");
    } else {
      push("permissions_changed", `Access status ${prev.access.accessStatus} → ${next.access.accessStatus}`);
    }
  }
  if (prev.org.assignmentScopes.length !== next.org.assignmentScopes.length) {
    push("responsibility_assignment", "Assignment scopes changed");
  }
  if (prev.identity.status !== "terminated" && next.identity.status === "terminated") {
    push("deactivated", "Employment / record deactivated");
  }

  if (out.length === 0) {
    push("record_saved", "Record saved");
  }

  return out;
}
