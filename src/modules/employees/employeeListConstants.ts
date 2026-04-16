import type { EmployeeAccessStatus, EmployeeAvailabilityKind, EmployeeRecordStatus } from "./model";

export const EMPLOYEE_RECORD_STATUSES: readonly EmployeeRecordStatus[] = ["active", "inactive", "terminated"] as const;

export const EMPLOYEE_ACCESS_STATUSES: readonly EmployeeAccessStatus[] = ["active", "blocked", "pending"] as const;

export const EMPLOYEE_AVAILABILITY_KINDS: readonly EmployeeAvailabilityKind[] = [
  "active",
  "vacation",
  "sick_leave",
  "dismissed",
  "temporarily_unavailable",
] as const;

/** Codes used in seed/reference data until dedicated masters exist */
export const EMPLOYEE_PRIMARY_ROLE_CODES = [
  "VIEWER",
  "OPERATIONS",
  "FINANCE",
  "MERCH",
  "ADMIN",
] as const;
