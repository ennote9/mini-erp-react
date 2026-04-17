/** Bounded reference codes until dedicated master-data modules exist. */

export const EMPLOYEE_DEPARTMENT_CODES = ["FINANCE", "LOGISTICS", "PURCHASING", "MERCH", "OPS", "IT"] as const;

export const EMPLOYEE_POSITION_CODES = [
  "FIN_CONTROLLER",
  "WAREHOUSE_LEAD",
  "BUYER",
  "CONTENT_MANAGER",
  "OPERATOR",
  "SYS_ADMIN",
] as const;
