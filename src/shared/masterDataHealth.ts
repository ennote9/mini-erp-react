/**
 * Live form health for master-data edit/create pages.
 * Mirrors validation rules from item/customer/supplier/warehouse services.
 * Returns Issue[] for use with combineIssues and getErrorAndWarningMessages.
 * Duplicate-code checks stay in services and surface as action issues only.
 */

import type { Issue } from "./issues";
import { fieldIssue } from "./issues";
import {
  validateItemCode,
  validateRequired,
  validateUOM,
  validatePhone,
  validateEmail,
  normalizeTrim,
  NAME_MIN_LENGTH,
} from "./validation";

export type ItemFormHealthInput = {
  code: string;
  name: string;
  uom: string;
  purchasePrice: string;
  salePrice: string;
};

export function getItemFormHealth(input: ItemFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateItemCode(input.code);
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  const uomErr = validateUOM(input.uom);
  if (uomErr) issues.push(fieldIssue("error", "uom", uomErr));

  const parseNum = (s: string): number | undefined => {
    const t = s.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };
  const purchase = parseNum(input.purchasePrice);
  if (purchase !== undefined) {
    if (Number.isNaN(purchase)) issues.push(fieldIssue("error", "purchasePrice", "Purchase price must be a valid number."));
    else if (purchase < 0) issues.push(fieldIssue("error", "purchasePrice", "Purchase price cannot be negative."));
  }
  const sale = parseNum(input.salePrice);
  if (sale !== undefined) {
    if (Number.isNaN(sale)) issues.push(fieldIssue("error", "salePrice", "Sale price must be a valid number."));
    else if (sale < 0) issues.push(fieldIssue("error", "salePrice", "Sale price cannot be negative."));
  }
  return { issues };
}

export type BrandFormHealthInput = {
  code: string;
  name: string;
};

export function getBrandFormHealth(input: BrandFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  return { issues };
}

export type CategoryFormHealthInput = {
  code: string;
  name: string;
};

export function getCategoryFormHealth(input: CategoryFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  return { issues };
}

export type CustomerFormHealthInput = {
  code: string;
  name: string;
  phone: string;
  email: string;
  paymentTermsDays: string;
};

export function getCustomerFormHealth(input: CustomerFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) issues.push(fieldIssue("error", "phone", phoneErr));
  const emailErr = validateEmail(input.email);
  if (emailErr) issues.push(fieldIssue("error", "email", emailErr));
  const pt = input.paymentTermsDays.trim();
  if (pt !== "") {
    const n = Number(pt);
    if (Number.isNaN(n)) issues.push(fieldIssue("error", "paymentTermsDays", "Payment terms must be a valid number."));
    else if (n < 0) issues.push(fieldIssue("error", "paymentTermsDays", "Payment terms cannot be negative."));
  }
  return { issues };
}

export type SupplierFormHealthInput = {
  code: string;
  name: string;
  phone: string;
  email: string;
  paymentTermsDays: string;
};

export function getSupplierFormHealth(input: SupplierFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) issues.push(fieldIssue("error", "phone", phoneErr));
  const emailErr = validateEmail(input.email);
  if (emailErr) issues.push(fieldIssue("error", "email", emailErr));
  const pt = input.paymentTermsDays.trim();
  if (pt !== "") {
    const n = Number(pt);
    if (Number.isNaN(n)) issues.push(fieldIssue("error", "paymentTermsDays", "Payment terms must be a valid number."));
    else if (n < 0) issues.push(fieldIssue("error", "paymentTermsDays", "Payment terms cannot be negative."));
  }
  return { issues };
}

export type WarehouseFormHealthInput = {
  code: string;
  name: string;
  phone: string;
};

export function getWarehouseFormHealth(input: WarehouseFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr) issues.push(fieldIssue("error", "code", codeErr));
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr) issues.push(fieldIssue("error", "name", nameErr));
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(fieldIssue("error", "name", `Name must be at least ${NAME_MIN_LENGTH} characters.`));
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) issues.push(fieldIssue("error", "phone", phoneErr));
  return { issues };
}
