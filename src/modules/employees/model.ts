/** Employees — ERP identity, responsibility, access, and participation (work data only). */

export type EmployeeRecordStatus = "active" | "inactive" | "terminated";

export type EmployeeAccessStatus = "active" | "blocked" | "pending";

export type EmployeeAvailabilityKind =
  | "active"
  | "vacation"
  | "sick_leave"
  | "dismissed"
  | "temporarily_unavailable";

export type EmployeeScopeEntityKind =
  | "category"
  | "brand"
  | "warehouse"
  | "supplier"
  | "customer"
  | "document_type"
  | "business_direction"
  | "project";

export interface EmployeeAssignmentScope {
  kind: EmployeeScopeEntityKind;
  entityId: string;
  label: string;
}

export interface EmployeeIdentity {
  employeeCode: string;
  personnelNumber: string;
  fullName: string;
  displayName: string;
  status: EmployeeRecordStatus;
  /** Local reference code until a Positions master module exists */
  positionCode: string;
  /** Local reference code until an Org master module exists */
  departmentCode: string;
  comment: string;
  photoDataUrl: string | null;
  employmentStartDate: string;
  employmentEndDate: string | null;
  /** Denormalized for list/summary; canonical definition lives under access */
  primarySystemRoleCode: string;
  directManagerId: string | null;
}

export interface EmployeeWorkContacts {
  workEmail: string;
  workPhone: string;
  internalExtension: string;
  corporateMessengerId: string;
  officeLocation: string;
}

export interface EmployeeOrgResponsibility {
  departmentCode: string;
  positionCode: string;
  directManagerId: string | null;
  functionalManagerId: string | null;
  teamOrGroup: string;
  responsibilityZone: string;
  assignmentScopes: EmployeeAssignmentScope[];
}

export interface EmployeeAccessProfile {
  isErpUser: boolean;
  login: string;
  primaryRoleCode: string;
  additionalRoleCodes: string[];
  permissionGroupCode: string;
  accessStatus: EmployeeAccessStatus;
  lastLoginAt: string | null;
  isAdministrator: boolean;
  allowedModuleCodes: string[];
  warehouseScopeIds: string[];
  categoryScopeIds: string[];
  brandScopeIds: string[];
  priceVisibility: "none" | "standard" | "extended";
  canApprove: boolean;
  canReview: boolean;
  canEditMaster: boolean;
  canDeleteDocuments: boolean;
  canArchive: boolean;
  financeVisibility: "none" | "limited" | "full";
}

export interface EmployeeBusinessRoleAssignment {
  roleCode: string;
  description: string;
  objectsHint: string;
}

export interface EmployeeProcessParticipation {
  participationType: string;
  detail: string;
}

export interface EmployeeBusinessRoles {
  assignedRoles: EmployeeBusinessRoleAssignment[];
  processParticipations: EmployeeProcessParticipation[];
  approvalResponsibilities: string[];
  canDoubleCheck: boolean;
  canFinalApprove: boolean;
  responsibleForObjectsNote: string;
}

export interface LinkedEntityRef {
  id: string;
  name: string;
  changedAt?: string;
  status?: string;
}

export interface EmployeeLinkedEntitySummary {
  assignedCategories: LinkedEntityRef[];
  assignedBrands: LinkedEntityRef[];
  assignedWarehouses: LinkedEntityRef[];
  documentTemplates: LinkedEntityRef[];
  createdObjectsPreview: LinkedEntityRef[];
  approvedObjectsPreview: LinkedEntityRef[];
  inWorkObjectsPreview: LinkedEntityRef[];
}

export type EmployeeBusinessFileKind =
  | "instruction"
  | "access"
  | "agreement"
  | "power_of_attorney"
  | "signature_scan"
  | "other";

export interface EmployeeBusinessFile {
  id: string;
  fileKind: EmployeeBusinessFileKind;
  title: string;
  uploadedAt: string;
  comment: string;
  storagePath?: string;
}

export interface EmployeeAvailabilityState {
  kind: EmployeeAvailabilityKind;
  periodStart: string;
  periodEnd: string | null;
  substituteEmployeeId: string | null;
  comment: string;
}

export type EmployeeAuditEventKind =
  | "created"
  | "position_changed"
  | "department_changed"
  | "roles_changed"
  | "permissions_changed"
  | "status_changed"
  | "deactivated"
  | "responsibility_assignment"
  | "access_block"
  | "access_unblock"
  | "login"
  | "record_saved";

export interface EmployeeAuditEvent {
  id: string;
  at: string;
  actorEmployeeId: string | null;
  actorLabel: string;
  kind: EmployeeAuditEventKind;
  summary: string;
  details?: string;
}

export interface Employee {
  id: string;
  identity: EmployeeIdentity;
  contacts: EmployeeWorkContacts;
  org: EmployeeOrgResponsibility;
  access: EmployeeAccessProfile;
  businessRoles: EmployeeBusinessRoles;
  linkedSummaries: EmployeeLinkedEntitySummary;
  availability: EmployeeAvailabilityState;
  files: EmployeeBusinessFile[];
  audit: EmployeeAuditEvent[];
}

export type CreateEmployeeInput = Omit<Employee, "id">;
export type UpdateEmployeePatch = Partial<Omit<Employee, "id">>;
