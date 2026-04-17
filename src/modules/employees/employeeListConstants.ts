import type {
  EmployeeEmploymentType,
  EmployeeGender,
  EmployeeIdentityDocumentType,
  EmployeeRecordStatus,
  EmployeeWorkSchedule,
} from "./model";
import { EMPLOYEE_EMPLOYMENT_TYPES, EMPLOYEE_WORK_SCHEDULES } from "./model";

export const EMPLOYEE_RECORD_STATUSES: readonly EmployeeRecordStatus[] = ["active", "inactive", "terminated"] as const;

export const EMPLOYEE_GENDERS: readonly EmployeeGender[] = ["unspecified", "female", "male"] as const;

export const EMPLOYEE_IDENTITY_DOCUMENT_TYPES: readonly EmployeeIdentityDocumentType[] = [
  "id_card_kz",
  "passport_kz",
  "passport_foreign",
  "residence_permit",
  "other",
] as const;

export const EMPLOYEE_LIST_EMPLOYMENT_TYPES: readonly EmployeeEmploymentType[] = [...EMPLOYEE_EMPLOYMENT_TYPES];

export const EMPLOYEE_LIST_WORK_SCHEDULES: readonly EmployeeWorkSchedule[] = [...EMPLOYEE_WORK_SCHEDULES];
