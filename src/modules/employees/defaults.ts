import type {
  Employee,
  EmployeeAccessProfile,
  EmployeeAssignmentScope,
  EmployeeAuditEvent,
  EmployeeAvailabilityState,
  EmployeeBusinessFile,
  EmployeeBusinessRoles,
  EmployeeIdentity,
  EmployeeLinkedEntitySummary,
  EmployeeOrgResponsibility,
  EmployeeWorkContacts,
} from "./model";

export function defaultAccessProfile(): EmployeeAccessProfile {
  return {
    isErpUser: false,
    login: "",
    primaryRoleCode: "VIEWER",
    additionalRoleCodes: [],
    permissionGroupCode: "STANDARD",
    accessStatus: "pending",
    lastLoginAt: null,
    isAdministrator: false,
    allowedModuleCodes: [],
    warehouseScopeIds: [],
    categoryScopeIds: [],
    brandScopeIds: [],
    priceVisibility: "standard",
    canApprove: false,
    canReview: false,
    canEditMaster: false,
    canDeleteDocuments: false,
    canArchive: false,
    financeVisibility: "limited",
  };
}

export function defaultBusinessRoles(): EmployeeBusinessRoles {
  return {
    assignedRoles: [],
    processParticipations: [],
    approvalResponsibilities: [],
    canDoubleCheck: false,
    canFinalApprove: false,
    responsibleForObjectsNote: "",
  };
}

export function defaultLinkedSummaries(): EmployeeLinkedEntitySummary {
  return {
    assignedCategories: [],
    assignedBrands: [],
    assignedWarehouses: [],
    documentTemplates: [],
    createdObjectsPreview: [],
    approvedObjectsPreview: [],
    inWorkObjectsPreview: [],
  };
}

export function defaultAvailability(): EmployeeAvailabilityState {
  return {
    kind: "active",
    periodStart: "",
    periodEnd: null,
    substituteEmployeeId: null,
    comment: "",
  };
}

export function defaultOrg(): EmployeeOrgResponsibility {
  return {
    departmentCode: "OPS",
    positionCode: "OPERATOR",
    directManagerId: null,
    functionalManagerId: null,
    teamOrGroup: "",
    responsibilityZone: "",
    assignmentScopes: [],
  };
}

export function defaultContacts(): EmployeeWorkContacts {
  return {
    workEmail: "",
    workPhone: "",
    internalExtension: "",
    corporateMessengerId: "",
    officeLocation: "",
  };
}

export function defaultIdentity(): EmployeeIdentity {
  return {
    employeeCode: "",
    personnelNumber: "",
    fullName: "",
    displayName: "",
    status: "active",
    positionCode: "OPERATOR",
    departmentCode: "OPS",
    comment: "",
    photoDataUrl: null,
    employmentStartDate: "",
    employmentEndDate: null,
    primarySystemRoleCode: "VIEWER",
    directManagerId: null,
  };
}

export function emptyEmployeeShell(): Omit<Employee, "id"> {
  return {
    identity: defaultIdentity(),
    contacts: defaultContacts(),
    org: defaultOrg(),
    access: defaultAccessProfile(),
    businessRoles: defaultBusinessRoles(),
    linkedSummaries: defaultLinkedSummaries(),
    availability: defaultAvailability(),
    files: [],
    audit: [],
  };
}

export function normalizeAuditEvent(raw: unknown): EmployeeAuditEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.at !== "string" ||
    typeof r.actorLabel !== "string" ||
    typeof r.kind !== "string" ||
    typeof r.summary !== "string"
  ) {
    return null;
  }
  return {
    id: r.id,
    at: r.at,
    actorEmployeeId: typeof r.actorEmployeeId === "string" ? r.actorEmployeeId : null,
    actorLabel: r.actorLabel,
    kind: r.kind as EmployeeAuditEvent["kind"],
    summary: r.summary,
    details: typeof r.details === "string" ? r.details : undefined,
  };
}

export function normalizeBusinessFile(raw: unknown): EmployeeBusinessFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.fileKind !== "string" ||
    typeof r.title !== "string" ||
    typeof r.uploadedAt !== "string" ||
    typeof r.comment !== "string"
  ) {
    return null;
  }
  return {
    id: r.id,
    fileKind: r.fileKind as EmployeeBusinessFile["fileKind"],
    title: r.title,
    uploadedAt: r.uploadedAt,
    comment: r.comment,
    storagePath: typeof r.storagePath === "string" ? r.storagePath : undefined,
  };
}

export function normalizeAssignmentScope(raw: unknown): EmployeeAssignmentScope | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== "string" || typeof r.entityId !== "string" || typeof r.label !== "string") return null;
  return {
    kind: r.kind as EmployeeAssignmentScope["kind"],
    entityId: r.entityId,
    label: r.label,
  };
}
