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

export const EMPLOYEE_PERMISSION_GROUPS = ["NONE", "STANDARD", "MERCH_EDIT", "WAREHOUSE_OPS", "FINANCE_FULL", "ADMIN"] as const;

export const EMPLOYEE_BUSINESS_ROLE_CODES = [
  "FINANCIAL_CONTROLLER",
  "WAREHOUSE_EMPLOYEE",
  "OPERATOR",
  "CONTENT_MANAGER",
  "BRAND_MANAGER",
  "CATEGORY_MANAGER",
  "BUYER",
  "APPROVER",
  "REVIEWER",
] as const;

export const EMPLOYEE_MODULE_CODES = [
  "items",
  "brands",
  "categories",
  "barcodes",
  "suppliers",
  "customers",
  "warehouses",
  "purchase-orders",
  "receipts",
  "sales-orders",
  "shipments",
  "stock-balances",
  "settings",
] as const;
