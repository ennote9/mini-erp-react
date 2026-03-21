import type { Issue } from "../../shared/issues";
import { actionIssue } from "../../shared/issues";
import { receiptRepository } from "./repository";
import { purchaseOrderRepository } from "../purchase-orders/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { stockMovementRepository } from "../stock-movements/repository";
import { stockBalanceRepository } from "../stock-balances/repository";
import { parseDocumentLineQty } from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";
import {
  normalizeCancelReasonComment,
  validateCancelDocumentReasonForm,
  normalizeReversalReasonComment,
  validateReversalDocumentReasonForm,
  type CancelDocumentReasonCode,
  type CancelDocumentReasonInput,
  type ReversalDocumentReasonCode,
  type ReversalDocumentReasonInput,
} from "../../shared/reasonCodes";
import { appendAuditEvent } from "../../shared/audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "../../shared/audit/eventLogTypes";

export type PostResult = { success: true } | { success: false; issues: Issue[] };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

export type ReverseDocumentResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Full-pass validation for a receipt (draft factual document).
 * Collects all blocking issues without stopping at the first — mirrors shipment validation style.
 */
export function validateReceiptFull(receiptId: string): Issue[] {
  const issues: Issue[] = [];
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) {
    issues.push(actionIssue("Receipt not found."));
    return issues;
  }
  if (receipt.status !== "draft") {
    issues.push(actionIssue("Only draft receipts can be posted."));
    return issues;
  }

  const poIdTrimmed = normalizeTrim(receipt.purchaseOrderId);
  if (poIdTrimmed === "") {
    issues.push(actionIssue("Related purchase order is required."));
  } else {
    const po = purchaseOrderRepository.getById(poIdTrimmed);
    if (!po) {
      issues.push(actionIssue("Related purchase order is required."));
    } else if (po.status !== "confirmed") {
      issues.push(
        actionIssue("Related purchase order must be confirmed before posting."),
      );
    }
  }

  const warehouseIdTrimmed = normalizeTrim(receipt.warehouseId);
  if (warehouseIdTrimmed === "") {
    issues.push(actionIssue("Warehouse is required."));
  } else {
    const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
    if (!warehouse) {
      issues.push(actionIssue("Warehouse is required."));
    } else if (!warehouse.isActive) {
      issues.push(actionIssue("Selected warehouse is inactive."));
    }
  }

  const lines = receiptRepository.listLines(receiptId);
  if (!lines || lines.length === 0) {
    issues.push(actionIssue("At least one line is required."));
  } else {
    const itemIds = new Set<string>();
    for (const line of lines) {
      const itemIdTrimmed = normalizeTrim(line.itemId);
      if (itemIdTrimmed === "") {
        issues.push(actionIssue("Each line must have an item."));
        continue;
      }
      const qty = parseDocumentLineQty(line.qty);
      if (qty === null) {
        issues.push(actionIssue("Quantity must be greater than zero."));
      }
      const item = itemRepository.getById(itemIdTrimmed);
      if (!item) {
        issues.push(actionIssue("Each line must have an item."));
      } else if (!item.isActive) {
        issues.push(actionIssue("Selected item is inactive."));
      }
      if (itemIds.has(itemIdTrimmed)) {
        issues.push(
          actionIssue("Duplicate items are not allowed in the same document."),
        );
      }
      itemIds.add(itemIdTrimmed);
    }

    if (receipt) {
      const postedForSamePo = receiptRepository
        .list()
        .some(
          (r) =>
            r.purchaseOrderId === receipt.purchaseOrderId &&
            r.id !== receiptId &&
            r.status === "posted",
        );
      if (postedForSamePo) {
        issues.push(
          actionIssue("A posted receipt already exists for this purchase order."),
        );
      }
    }
  }

  return issues;
}

export function post(receiptId: string): PostResult {
  const issues = validateReceiptFull(receiptId);
  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) return { success: false, issues };

  const receipt = receiptRepository.getById(receiptId)!;
  const lines = receiptRepository.listLines(receiptId);
  const now = new Date().toISOString();

  for (const line of lines) {
    stockMovementRepository.create({
      datetime: now,
      movementType: "receipt",
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyDelta: line.qty,
      sourceDocumentType: "receipt",
      sourceDocumentId: receiptId,
    });

    const existing = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      receipt.warehouseId,
    );
    const newQty = (existing?.qtyOnHand ?? 0) + line.qty;
    stockBalanceRepository.upsert({
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyOnHand: newQty,
    });
  }

  const prevStatus = receipt.status;
  receiptRepository.update(receiptId, { status: "posted" });
  purchaseOrderRepository.update(receipt.purchaseOrderId, { status: "closed" });
  appendAuditEvent({
    entityType: "receipt",
    entityId: receiptId,
    eventType: "document_posted",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: receipt.number,
      previousStatus: prevStatus,
      newStatus: "posted" as const,
      purchaseOrderId: receipt.purchaseOrderId,
    },
  });
  return { success: true };
}

export function cancelDocument(
  receiptId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const reasonErr = validateCancelDocumentReasonForm(input.cancelReasonCode);
  if (reasonErr) return { success: false, error: reasonErr };
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) return { success: false, error: "Receipt not found." };
  if (receipt.status !== "draft")
    return { success: false, error: "Only draft receipts can be cancelled." };
  const code = input.cancelReasonCode as CancelDocumentReasonCode;
  const comment = normalizeCancelReasonComment(input.cancelReasonComment);
  const prevStatus = receipt.status;
  receiptRepository.update(receiptId, {
    status: "cancelled",
    cancelReasonCode: code,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  appendAuditEvent({
    entityType: "receipt",
    entityId: receiptId,
    eventType: "document_cancelled",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: receipt.number,
      previousStatus: prevStatus,
      newStatus: "cancelled" as const,
      cancelReasonCode: code,
      cancelReasonComment: comment ?? null,
    },
  });
  return { success: true };
}

/**
 * Full reversal of a posted receipt: compensating stock movements (receipt_reversal),
 * balances reduced, status → reversed, linked PO reopened to confirmed. One-time only.
 */
export function reverseDocument(
  receiptId: string,
  input: ReversalDocumentReasonInput,
): ReverseDocumentResult {
  const reasonErr = validateReversalDocumentReasonForm(input.reversalReasonCode);
  if (reasonErr) return { success: false, error: reasonErr };

  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) return { success: false, error: "Receipt not found." };
  if (receipt.status === "reversed") {
    return { success: false, error: "This receipt is already reversed." };
  }
  if (receipt.status !== "posted") {
    return { success: false, error: "Only posted receipts can be reversed." };
  }

  const lines = receiptRepository.listLines(receiptId);
  if (lines.length === 0) {
    return { success: false, error: "Receipt has no lines; cannot reverse." };
  }

  for (const line of lines) {
    const qty = parseDocumentLineQty(line.qty);
    if (qty === null) {
      return { success: false, error: "One or more lines have invalid quantity for reversal." };
    }
    const balance = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      receipt.warehouseId,
    );
    const onHand = balance?.qtyOnHand ?? 0;
    if (onHand < qty) {
      const item = itemRepository.getById(line.itemId);
      const code = item?.code ?? line.itemId;
      return {
        success: false,
        error: `Item ${code}: insufficient stock to reverse receipt (available ${onHand}, required ${qty}).`,
      };
    }
  }

  const now = new Date().toISOString();
  const code = input.reversalReasonCode as ReversalDocumentReasonCode;
  const revComment = normalizeReversalReasonComment(input.reversalReasonComment);

  for (const line of lines) {
    const qty = parseDocumentLineQty(line.qty)!;
    stockMovementRepository.create({
      datetime: now,
      movementType: "receipt_reversal",
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyDelta: -qty,
      sourceDocumentType: "receipt",
      sourceDocumentId: receiptId,
      comment: "Receipt reversal (compensating movement)",
    });
    const existing = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      receipt.warehouseId,
    );
    const newQty = Math.max(0, (existing?.qtyOnHand ?? 0) - qty);
    stockBalanceRepository.upsert({
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyOnHand: newQty,
    });
  }

  const prevStatus = receipt.status;
  receiptRepository.update(receiptId, {
    status: "reversed",
    reversalReasonCode: code,
    ...(revComment !== undefined ? { reversalReasonComment: revComment } : {}),
  });

  purchaseOrderRepository.update(receipt.purchaseOrderId, { status: "confirmed" });

  appendAuditEvent({
    entityType: "receipt",
    entityId: receiptId,
    eventType: "document_reversed",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: receipt.number,
      previousStatus: prevStatus,
      newStatus: "reversed" as const,
      reversalReasonCode: code,
      reversalReasonComment: revComment ?? null,
      movementLineCount: lines.length,
      purchaseOrderId: receipt.purchaseOrderId,
    },
  });

  return { success: true };
}

export const receiptService = {
  post,
  cancelDocument,
  reverseDocument,
};
