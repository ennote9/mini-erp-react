export const EMPLOYEE_TAB_IDS = [
  "main",
  "org",
  "contacts",
  "access",
  "businessRoles",
  "linked",
  "files",
  "availability",
  "history",
] as const;

export type EmployeeTabId = (typeof EMPLOYEE_TAB_IDS)[number];

export const EMPLOYEE_TAB_IDS_SET: ReadonlySet<string> = new Set(EMPLOYEE_TAB_IDS);
