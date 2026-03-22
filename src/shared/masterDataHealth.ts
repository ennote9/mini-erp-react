/**
 * Live form health for master-data edit/create pages.
 * Mirrors validation rules from item/customer/supplier/warehouse services.
 * Returns Issue[] for use with combineIssues and DocumentIssueStrip.
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
  UOM_MAX_LENGTH,
} from "./validation";
import { isCarrierTypeId } from "../modules/carriers/model";

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
  if (codeErr) {
    const key =
      codeErr.includes("only contain") || codeErr.includes("letters, numbers")
        ? "issues.master.itemCodePattern"
        : "issues.master.codeRequired";
    issues.push(fieldIssue("error", "code", codeErr, { key }));
  }
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
  }
  const uomErr = validateUOM(input.uom);
  if (uomErr) {
    const key = uomErr.includes("fewer")
      ? "issues.master.uomMaxLength"
      : "issues.master.uomRequired";
    const params = uomErr.includes("fewer") ? { max: UOM_MAX_LENGTH } : undefined;
    issues.push(fieldIssue("error", "uom", uomErr, { key, params }));
  }

  const purchaseTrim = input.purchasePrice.trim();
  if (purchaseTrim !== "") {
    const purchase = Number(purchaseTrim);
    if (Number.isNaN(purchase))
      issues.push(
        fieldIssue("error", "purchasePrice", "Purchase price must be a valid number.", {
          key: "issues.master.purchasePriceInvalid",
        }),
      );
    else if (purchase < 0)
      issues.push(
        fieldIssue("error", "purchasePrice", "Purchase price cannot be negative.", {
          key: "issues.master.purchasePriceNegative",
        }),
      );
  }
  const saleTrim = input.salePrice.trim();
  if (saleTrim !== "") {
    const sale = Number(saleTrim);
    if (Number.isNaN(sale))
      issues.push(
        fieldIssue("error", "salePrice", "Sale price must be a valid number.", {
          key: "issues.master.salePriceInvalid",
        }),
      );
    else if (sale < 0)
      issues.push(
        fieldIssue("error", "salePrice", "Sale price cannot be negative.", {
          key: "issues.master.salePriceNegative",
        }),
      );
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
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
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
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
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
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) {
    const key = phoneErr.includes("digit")
      ? "issues.master.phoneDigit"
      : "issues.master.phoneFormat";
    issues.push(fieldIssue("error", "phone", phoneErr, { key }));
  }
  const emailErr = validateEmail(input.email);
  if (emailErr)
    issues.push(
      fieldIssue("error", "email", emailErr, { key: "issues.master.emailInvalid" }),
    );
  const pt = input.paymentTermsDays.trim();
  if (pt !== "") {
    const n = Number(pt);
    if (Number.isNaN(n))
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms must be a valid number.",
          { key: "issues.master.paymentTermsInvalid" },
        ),
      );
    else if (n < 0)
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms cannot be negative.",
          { key: "issues.master.paymentTermsNegative" },
        ),
      );
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
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) {
    const key = phoneErr.includes("digit")
      ? "issues.master.phoneDigit"
      : "issues.master.phoneFormat";
    issues.push(fieldIssue("error", "phone", phoneErr, { key }));
  }
  const emailErr = validateEmail(input.email);
  if (emailErr)
    issues.push(
      fieldIssue("error", "email", emailErr, { key: "issues.master.emailInvalid" }),
    );
  const pt = input.paymentTermsDays.trim();
  if (pt !== "") {
    const n = Number(pt);
    if (Number.isNaN(n))
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms must be a valid number.",
          { key: "issues.master.paymentTermsInvalid" },
        ),
      );
    else if (n < 0)
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms cannot be negative.",
          { key: "issues.master.paymentTermsNegative" },
        ),
      );
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
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
  }
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) {
    const key = phoneErr.includes("digit")
      ? "issues.master.phoneDigit"
      : "issues.master.phoneFormat";
    issues.push(fieldIssue("error", "phone", phoneErr, { key }));
  }
  return { issues };
}

export type CarrierFormHealthInput = {
  code: string;
  name: string;
  carrierType: string;
  phone: string;
  email: string;
  paymentTermsDays: string;
};

export function getCarrierFormHealth(input: CarrierFormHealthInput): { issues: Issue[] } {
  const issues: Issue[] = [];
  const codeErr = validateRequired(input.code, "Code");
  if (codeErr)
    issues.push(
      fieldIssue("error", "code", codeErr, { key: "issues.master.codeRequired" }),
    );
  const nameErr = validateRequired(input.name, "Name");
  if (nameErr)
    issues.push(
      fieldIssue("error", "name", nameErr, { key: "issues.master.nameRequired" }),
    );
  else {
    const t = normalizeTrim(input.name);
    if (t.length > 0 && t.length < NAME_MIN_LENGTH)
      issues.push(
        fieldIssue(
          "error",
          "name",
          `Name must be at least ${NAME_MIN_LENGTH} characters.`,
          {
            key: "issues.master.nameMinLength",
            params: { min: NAME_MIN_LENGTH },
          },
        ),
      );
  }
  const ct = normalizeTrim(input.carrierType);
  if (ct === "")
    issues.push(
      fieldIssue("error", "carrierType", "Carrier type is required.", {
        key: "issues.master.carrierTypeRequired",
      }),
    );
  else if (!isCarrierTypeId(ct))
    issues.push(
      fieldIssue("error", "carrierType", "Select a valid carrier type.", {
        key: "issues.master.carrierTypeInvalid",
      }),
    );
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) {
    const key = phoneErr.includes("digit")
      ? "issues.master.phoneDigit"
      : "issues.master.phoneFormat";
    issues.push(fieldIssue("error", "phone", phoneErr, { key }));
  }
  const emailErr = validateEmail(input.email);
  if (emailErr)
    issues.push(
      fieldIssue("error", "email", emailErr, { key: "issues.master.emailInvalid" }),
    );
  const pt = input.paymentTermsDays.trim();
  if (pt !== "") {
    const n = Number(pt);
    if (Number.isNaN(n))
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms must be a valid number.",
          { key: "issues.master.paymentTermsInvalid" },
        ),
      );
    else if (n < 0)
      issues.push(
        fieldIssue(
          "error",
          "paymentTermsDays",
          "Payment terms cannot be negative.",
          { key: "issues.master.paymentTermsNegative" },
        ),
      );
  }
  return { issues };
}
