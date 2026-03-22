/**
 * Document-level health for PO and SO.
 * Returns shared Issue[] (severity: error | warning) and lineHealth for row styling.
 * Callers derive error/warning message lists via getErrorAndWarningMessages(health.issues).
 * No stock/availability logic here.
 */

import type { Issue } from "./issues";
import { fieldIssue } from "./issues";
import { normalizeTrim } from "./validation";
import { parseDocumentLineQty } from "./documentValidation";
import { itemRepository } from "../modules/items/repository";
import { lineAmountMoney, roundMoney } from "./commercialMoney";
import { validatePaymentTermsDaysForm } from "./planningCommercialDates";
import { isZeroPriceLineReasonCode } from "./reasonCodes";
import { getAppSettings } from "./settings/store";

export type DocumentHealth = {
  /** Document-level issues; use getErrorAndWarningMessages(issues) for message lists. */
  issues: Issue[];
  /** Per-line: 'error' | 'warning' | null. Key = _lineId (number). Used for row styling. */
  lineHealth: Map<number, "error" | "warning" | null>;
};

type LineFormRow = {
  itemId: string;
  qty: number;
  unitPrice: number;
  _lineId: number;
  /** Required when unitPrice is 0 (draft form uses "" when unset). */
  zeroPriceReasonCode?: string;
};

function docIssue(
  severity: Issue["severity"],
  message: string,
  i18n?: { key: string; params?: Record<string, string | number> },
): Issue {
  return {
    severity,
    scope: "document",
    message,
    ...(i18n ? { i18nKey: i18n.key, i18nParams: i18n.params } : {}),
  };
}

function lineAmount(line: LineFormRow): number {
  const q = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
  const rawP = line.unitPrice;
  const p = typeof rawP === "number" && Number.isFinite(rawP) ? roundMoney(rawP) : 0;
  return lineAmountMoney(q, p);
}

export type PurchaseOrderHealthInput = {
  supplierId: string;
  warehouseId: string;
  /** Raw payment terms field (draft); empty allowed. */
  paymentTermsDays?: string;
  lines: LineFormRow[];
};

export function getPurchaseOrderHealth(input: PurchaseOrderHealthInput): DocumentHealth {
  const issues: Issue[] = [];
  const lineHealth = new Map<number, "error" | "warning" | null>();
  const zeroPriceReasonRequired = getAppSettings().commercial.zeroPriceLinesRequireReason;

  if (normalizeTrim(input.supplierId) === "") {
    issues.push(
      fieldIssue("error", "supplierId", "Supplier is required.", {
        key: "issues.document.supplierRequired",
      }),
    );
  }
  if (normalizeTrim(input.warehouseId) === "") {
    issues.push(
      fieldIssue("error", "warehouseId", "Warehouse is required.", {
        key: "issues.document.warehouseRequired",
      }),
    );
  }

  const termsErrPo = validatePaymentTermsDaysForm(input.paymentTermsDays);
  if (termsErrPo) {
    issues.push(
      fieldIssue("error", "paymentTermsDays", termsErrPo, {
        key: "issues.master.paymentTermsDaysForm",
      }),
    );
  }

  const lines = input.lines ?? [];
  let validLineCount = 0;
  let linesWithZeroPrice = 0;
  let linesWithZeroAmount = 0;
  let linesWithZeroPriceMissingReason = 0;
  let hasAnyInactiveItem = false;

  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    const qtyValid = parseDocumentLineQty(line.qty) !== null;
    const hasStructuralError = itemIdTrimmed === "" || !qtyValid;

    if (hasStructuralError) {
      lineHealth.set(line._lineId, "error");
      continue;
    }

    const item = itemRepository.getById(itemIdTrimmed);
    if (!item || !item.isActive) {
      lineHealth.set(line._lineId, "error");
      if (item && !item.isActive) hasAnyInactiveItem = true;
      continue;
    }

    validLineCount += 1;
    const rawUp = line.unitPrice;
    const upOk = typeof rawUp === "number" && Number.isFinite(rawUp);
    if (!upOk || rawUp < 0) {
      lineHealth.set(line._lineId, "error");
      continue;
    }
    const up = roundMoney(rawUp);
    const amount = lineAmount(line);
    const hasZeroPriceReason = isZeroPriceLineReasonCode(line.zeroPriceReasonCode);
    if (up === 0 && !hasZeroPriceReason) {
      if (zeroPriceReasonRequired) {
        lineHealth.set(line._lineId, "error");
        linesWithZeroPriceMissingReason += 1;
        linesWithZeroPrice += 1;
        if (amount === 0) linesWithZeroAmount += 1;
        continue;
      }
      lineHealth.set(line._lineId, "warning");
      linesWithZeroPrice += 1;
      if (amount === 0) linesWithZeroAmount += 1;
      continue;
    }
    const hasWarning = up === 0 || amount === 0;
    if (hasWarning) {
      lineHealth.set(line._lineId, "warning");
      if (up === 0) linesWithZeroPrice += 1;
      if (amount === 0) linesWithZeroAmount += 1;
    } else {
      lineHealth.set(line._lineId, null);
    }
  }

  if (lines.length === 0) {
    issues.push(
      docIssue("error", "At least one line is required.", {
        key: "issues.document.linesRequired",
      }),
    );
  } else {
    if (validLineCount === 0) {
      issues.push(
        docIssue(
          "error",
          "At least one valid line is required (item and quantity).",
          { key: "issues.document.linesValidRequired" },
        ),
      );
    }
    if (hasAnyInactiveItem) {
      issues.push(
        docIssue("error", "Inactive items cannot be used in this document.", {
          key: "issues.document.inactiveItems",
        }),
      );
    }
    const hasAnyEmptyItem = lines.some((l) => normalizeTrim(l.itemId) === "");
    if (hasAnyEmptyItem) {
      issues.push(
        docIssue("error", "One or more lines have no item.", {
          key: "issues.document.linesNoItem",
        }),
      );
    }
    const hasAnyInvalidQty = lines.some((l) => parseDocumentLineQty(l.qty) === null);
    if (hasAnyInvalidQty) {
      issues.push(
        docIssue("error", "One or more lines have invalid or zero quantity.", {
          key: "issues.document.linesInvalidQty",
        }),
      );
    }
    const hasAnyInvalidUnitPrice = lines.some((l) => {
      const u = l.unitPrice;
      return !(typeof u === "number" && Number.isFinite(u) && u >= 0);
    });
    if (hasAnyInvalidUnitPrice) {
      issues.push(
        docIssue(
          "error",
          "One or more lines have an invalid unit price (must be a number ≥ 0).",
          { key: "issues.document.linesInvalidUnitPrice" },
        ),
      );
    }
  }

  if (zeroPriceReasonRequired && linesWithZeroPriceMissingReason > 0) {
    issues.push(
      docIssue(
        "error",
        linesWithZeroPriceMissingReason === 1
          ? "One line has zero unit price without a reason. Select a zero-price reason for that line."
          : `${linesWithZeroPriceMissingReason} lines have zero unit price without a reason.`,
        linesWithZeroPriceMissingReason === 1
          ? { key: "issues.document.zeroPriceMissingReasonOne" }
          : {
              key: "issues.document.zeroPriceMissingReasonMany",
              params: { count: linesWithZeroPriceMissingReason },
            },
      ),
    );
  }
  if (linesWithZeroPrice > 0 && linesWithZeroPriceMissingReason === 0) {
    issues.push(
      docIssue(
        "warning",
        linesWithZeroPrice === 1
          ? "1 line has zero unit price (reason recorded)."
          : `${linesWithZeroPrice} lines have zero unit price (reasons recorded).`,
        linesWithZeroPrice === 1
          ? { key: "issues.document.zeroPriceRecordedOne" }
          : {
              key: "issues.document.zeroPriceRecordedMany",
              params: { count: linesWithZeroPrice },
            },
      ),
    );
  }
  if (linesWithZeroAmount > 0) {
    issues.push(
      docIssue(
        "warning",
        linesWithZeroAmount === 1
          ? "1 line has zero line amount."
          : `${linesWithZeroAmount} lines have zero line amount.`,
        linesWithZeroAmount === 1
          ? { key: "issues.document.zeroLineAmountOne" }
          : {
              key: "issues.document.zeroLineAmountMany",
              params: { count: linesWithZeroAmount },
            },
      ),
    );
  }

  return { issues, lineHealth };
}

export type SalesOrderHealthInput = {
  customerId: string;
  warehouseId: string;
  paymentTermsDays?: string;
  lines: LineFormRow[];
};

export function getSalesOrderHealth(input: SalesOrderHealthInput): DocumentHealth {
  const issues: Issue[] = [];
  const lineHealth = new Map<number, "error" | "warning" | null>();
  const zeroPriceReasonRequired = getAppSettings().commercial.zeroPriceLinesRequireReason;

  if (normalizeTrim(input.customerId) === "") {
    issues.push(
      fieldIssue("error", "customerId", "Customer is required.", {
        key: "issues.document.customerRequired",
      }),
    );
  }
  if (normalizeTrim(input.warehouseId) === "") {
    issues.push(
      fieldIssue("error", "warehouseId", "Warehouse is required.", {
        key: "issues.document.warehouseRequired",
      }),
    );
  }

  const termsErrSo = validatePaymentTermsDaysForm(input.paymentTermsDays);
  if (termsErrSo) {
    issues.push(
      fieldIssue("error", "paymentTermsDays", termsErrSo, {
        key: "issues.master.paymentTermsDaysForm",
      }),
    );
  }

  const lines = input.lines ?? [];
  let validLineCount = 0;
  let linesWithZeroPrice = 0;
  let linesWithZeroAmount = 0;
  let linesWithZeroPriceMissingReason = 0;
  let hasAnyInactiveItem = false;

  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    const qtyValid = parseDocumentLineQty(line.qty) !== null;
    const hasStructuralError = itemIdTrimmed === "" || !qtyValid;

    if (hasStructuralError) {
      lineHealth.set(line._lineId, "error");
      continue;
    }

    const item = itemRepository.getById(itemIdTrimmed);
    if (!item || !item.isActive) {
      lineHealth.set(line._lineId, "error");
      if (item && !item.isActive) hasAnyInactiveItem = true;
      continue;
    }

    validLineCount += 1;
    const rawUp = line.unitPrice;
    const upOk = typeof rawUp === "number" && Number.isFinite(rawUp);
    if (!upOk || rawUp < 0) {
      lineHealth.set(line._lineId, "error");
      continue;
    }
    const up = roundMoney(rawUp);
    const amount = lineAmount(line);
    const hasZeroPriceReason = isZeroPriceLineReasonCode(line.zeroPriceReasonCode);
    if (up === 0 && !hasZeroPriceReason) {
      if (zeroPriceReasonRequired) {
        lineHealth.set(line._lineId, "error");
        linesWithZeroPriceMissingReason += 1;
        linesWithZeroPrice += 1;
        if (amount === 0) linesWithZeroAmount += 1;
        continue;
      }
      lineHealth.set(line._lineId, "warning");
      linesWithZeroPrice += 1;
      if (amount === 0) linesWithZeroAmount += 1;
      continue;
    }
    const hasWarning = up === 0 || amount === 0;
    if (hasWarning) {
      lineHealth.set(line._lineId, "warning");
      if (up === 0) linesWithZeroPrice += 1;
      if (amount === 0) linesWithZeroAmount += 1;
    } else {
      lineHealth.set(line._lineId, null);
    }
  }

  if (lines.length === 0) {
    issues.push(
      docIssue("error", "At least one line is required.", {
        key: "issues.document.linesRequired",
      }),
    );
  } else {
    if (validLineCount === 0) {
      issues.push(
        docIssue(
          "error",
          "At least one valid line is required (item and quantity).",
          { key: "issues.document.linesValidRequired" },
        ),
      );
    }
    if (hasAnyInactiveItem) {
      issues.push(
        docIssue("error", "Inactive items cannot be used in this document.", {
          key: "issues.document.inactiveItems",
        }),
      );
    }
    const hasAnyEmptyItem = lines.some((l) => normalizeTrim(l.itemId) === "");
    if (hasAnyEmptyItem) {
      issues.push(
        docIssue("error", "One or more lines have no item.", {
          key: "issues.document.linesNoItem",
        }),
      );
    }
    const hasAnyInvalidQty = lines.some((l) => parseDocumentLineQty(l.qty) === null);
    if (hasAnyInvalidQty) {
      issues.push(
        docIssue("error", "One or more lines have invalid or zero quantity.", {
          key: "issues.document.linesInvalidQty",
        }),
      );
    }
    const hasAnyInvalidUnitPrice = lines.some((l) => {
      const u = l.unitPrice;
      return !(typeof u === "number" && Number.isFinite(u) && u >= 0);
    });
    if (hasAnyInvalidUnitPrice) {
      issues.push(
        docIssue(
          "error",
          "One or more lines have an invalid unit price (must be a number ≥ 0).",
          { key: "issues.document.linesInvalidUnitPrice" },
        ),
      );
    }
  }

  if (zeroPriceReasonRequired && linesWithZeroPriceMissingReason > 0) {
    issues.push(
      docIssue(
        "error",
        linesWithZeroPriceMissingReason === 1
          ? "One line has zero unit price without a reason. Select a zero-price reason for that line."
          : `${linesWithZeroPriceMissingReason} lines have zero unit price without a reason.`,
        linesWithZeroPriceMissingReason === 1
          ? { key: "issues.document.zeroPriceMissingReasonOne" }
          : {
              key: "issues.document.zeroPriceMissingReasonMany",
              params: { count: linesWithZeroPriceMissingReason },
            },
      ),
    );
  }
  if (linesWithZeroPrice > 0 && linesWithZeroPriceMissingReason === 0) {
    issues.push(
      docIssue(
        "warning",
        linesWithZeroPrice === 1
          ? "1 line has zero unit price (reason recorded)."
          : `${linesWithZeroPrice} lines have zero unit price (reasons recorded).`,
        linesWithZeroPrice === 1
          ? { key: "issues.document.zeroPriceRecordedOne" }
          : {
              key: "issues.document.zeroPriceRecordedMany",
              params: { count: linesWithZeroPrice },
            },
      ),
    );
  }
  if (linesWithZeroAmount > 0) {
    issues.push(
      docIssue(
        "warning",
        linesWithZeroAmount === 1
          ? "1 line has zero line amount."
          : `${linesWithZeroAmount} lines have zero line amount.`,
        linesWithZeroAmount === 1
          ? { key: "issues.document.zeroLineAmountOne" }
          : {
              key: "issues.document.zeroLineAmountMany",
              params: { count: linesWithZeroAmount },
            },
      ),
    );
  }

  return { issues, lineHealth };
}
