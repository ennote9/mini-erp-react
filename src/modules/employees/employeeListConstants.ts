import type { EmployeeRecordStatus } from "./model";

export const EMPLOYEE_RECORD_STATUSES: readonly EmployeeRecordStatus[] = ["active", "inactive", "terminated"] as const;
