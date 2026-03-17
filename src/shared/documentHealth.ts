/**
 * Document-level health for PO and SO: errors (block confirm), warnings (do not block).
 * Line-level flags for grid row styling.
 * No stock/availability logic here.
 */

import { normalizeTrim } from "./validation";
import { parseDocumentLineQty } from "./documentValidation";

export type DocumentHealth = {
  errors: string[];
  warnings: string[];
  /** Per-line: 'error' | 'warning' | null. Key = _lineId (number). */
  lineHealth: Map<number, "error" | "warning" | null>;
};

type LineFormRow = { itemId: string; qty: number; unitPrice: number; _lineId: number };

function lineAmount(line: LineFormRow): number {
  const q = typeof line.qty === "number" && !Number.isNaN(line.qty) ? line.qty : 0;
  const p = typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) ? line.unitPrice : 0;
  return q * p;
}

export type PurchaseOrderHealthInput = {
  supplierId: string;
  warehouseId: string;
  lines: LineFormRow[];
};

export function getPurchaseOrderHealth(input: PurchaseOrderHealthInput): DocumentHealth {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lineHealth = new Map<number, "error" | "warning" | null>();

  if (normalizeTrim(input.supplierId) === "") {
    errors.push("Supplier is required.");
  }
  if (normalizeTrim(input.warehouseId) === "") {
    errors.push("Warehouse is required.");
  }

  const lines = input.lines ?? [];
  let validLineCount = 0;
  let linesWithZeroPrice = 0;
  let linesWithZeroAmount = 0;

  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    const qtyValid = parseDocumentLineQty(line.qty) !== null;
    const hasStructuralError = itemIdTrimmed === "" || !qtyValid;

    if (hasStructuralError) {
      lineHealth.set(line._lineId, "error");
      if (itemIdTrimmed === "") {
        // per-line error message not duplicated at doc level; doc-level "no valid lines" or "lines have issues" is enough
      }
    } else {
      validLineCount += 1;
      const up = typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) ? line.unitPrice : 0;
      const amount = lineAmount(line);
      const hasWarning = up <= 0 || amount <= 0;
      if (hasWarning) {
        lineHealth.set(line._lineId, "warning");
        if (up <= 0) linesWithZeroPrice += 1;
        if (amount <= 0) linesWithZeroAmount += 1;
      } else {
        lineHealth.set(line._lineId, null);
      }
    }
  }

  if (lines.length === 0) {
    errors.push("At least one line is required.");
  } else {
    if (validLineCount === 0) {
      errors.push("At least one valid line is required (item and quantity).");
    }
    const hasAnyEmptyItem = lines.some((l) => normalizeTrim(l.itemId) === "");
    if (hasAnyEmptyItem) {
      errors.push("One or more lines have no item.");
    }
    const hasAnyInvalidQty = lines.some((l) => parseDocumentLineQty(l.qty) === null);
    if (hasAnyInvalidQty) {
      errors.push("One or more lines have invalid or zero quantity.");
    }
  }

  if (linesWithZeroPrice > 0) {
    warnings.push(
      linesWithZeroPrice === 1
        ? "1 line has zero unit price."
        : `${linesWithZeroPrice} lines have zero unit price.`,
    );
  }
  if (linesWithZeroAmount > 0) {
    warnings.push(
      linesWithZeroAmount === 1
        ? "1 line has zero line amount."
        : `${linesWithZeroAmount} lines have zero line amount.`,
    );
  }

  return { errors, warnings, lineHealth };
}

export type SalesOrderHealthInput = {
  customerId: string;
  warehouseId: string;
  lines: LineFormRow[];
};

export function getSalesOrderHealth(input: SalesOrderHealthInput): DocumentHealth {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lineHealth = new Map<number, "error" | "warning" | null>();

  if (normalizeTrim(input.customerId) === "") {
    errors.push("Customer is required.");
  }
  if (normalizeTrim(input.warehouseId) === "") {
    errors.push("Warehouse is required.");
  }

  const lines = input.lines ?? [];
  let validLineCount = 0;
  let linesWithZeroPrice = 0;
  let linesWithZeroAmount = 0;

  for (const line of lines) {
    const itemIdTrimmed = normalizeTrim(line.itemId);
    const qtyValid = parseDocumentLineQty(line.qty) !== null;
    const hasStructuralError = itemIdTrimmed === "" || !qtyValid;

    if (hasStructuralError) {
      lineHealth.set(line._lineId, "error");
    } else {
      validLineCount += 1;
      const up = typeof line.unitPrice === "number" && !Number.isNaN(line.unitPrice) ? line.unitPrice : 0;
      const amount = lineAmount(line);
      const hasWarning = up <= 0 || amount <= 0;
      if (hasWarning) {
        lineHealth.set(line._lineId, "warning");
        if (up <= 0) linesWithZeroPrice += 1;
        if (amount <= 0) linesWithZeroAmount += 1;
      } else {
        lineHealth.set(line._lineId, null);
      }
    }
  }

  if (lines.length === 0) {
    errors.push("At least one line is required.");
  } else {
    if (validLineCount === 0) {
      errors.push("At least one valid line is required (item and quantity).");
    }
    const hasAnyEmptyItem = lines.some((l) => normalizeTrim(l.itemId) === "");
    if (hasAnyEmptyItem) {
      errors.push("One or more lines have no item.");
    }
    const hasAnyInvalidQty = lines.some((l) => parseDocumentLineQty(l.qty) === null);
    if (hasAnyInvalidQty) {
      errors.push("One or more lines have invalid or zero quantity.");
    }
  }

  if (linesWithZeroPrice > 0) {
    warnings.push(
      linesWithZeroPrice === 1
        ? "1 line has zero unit price."
        : `${linesWithZeroPrice} lines have zero unit price.`,
    );
  }
  if (linesWithZeroAmount > 0) {
    warnings.push(
      linesWithZeroAmount === 1
        ? "1 line has zero line amount."
        : `${linesWithZeroAmount} lines have zero line amount.`,
    );
  }

  return { errors, warnings, lineHealth };
}
