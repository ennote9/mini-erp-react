export const EMPLOYEE_TAB_IDS = ["main", "org", "contacts"] as const;

export type EmployeeTabId = (typeof EMPLOYEE_TAB_IDS)[number];
