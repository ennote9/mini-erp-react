import type { Issue } from "../../shared/issues";
import { actionIssue, actionWarning } from "../../shared/issues";
import { shipmentRepository } from "./repository";
import { salesOrderRepository } from "../sales-orders/repository";
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
import {
  aggregateShippedQtyByItemForSalesOrder,
  computeSalesOrderFulfillment,
  getSalesOrderOrderedQtyByItemId,
} from "../../shared/planningFulfillment";

export type PostResult = { success: true } | { success: false; issues: Issue[] };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

export type ReverseDocumentResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Full-pass validation: collect all errors (and warnings) for the shipment without stopping at the first.
 * Used for Post validation and for Document issues display.
 */
export function validateShipmentFull(shipmentId: string): Issue[] {
  const issues: Issue[] = [];
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) {
    issues.push(actionIssue("Shipment not found."));
    return issues;
  }
  if (shipment.status !== "draft") {
    issues.push(actionIssue("Only draft shipments can be posted."));
    return issues;
  }

  const soIdTrimmed = normalizeTrim(shipment.salesOrderId);
  if (soIdTrimmed === "") {
    issues.push(actionIssue("Related sales order is required."));
  } else {
    const so = salesOrderRepository.getById(soIdTrimmed);
    if (!so) {
      issues.push(actionIssue("Related sales order is required."));
    } else if (so.status !== "confirmed") {
      issues.push(actionIssue("Related sales order must be confirmed before posting."));
    }
  }

  const warehouseIdTrimmed = normalizeTrim(shipment.warehouseId);
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

  const lines = shipmentRepository.listLines(shipmentId);
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
        issues.push(actionIssue("Duplicate items are not allowed in the same document."));
      }
      itemIds.add(itemIdTrimmed);
    }

    if (shipment) {
      const soIdForMatch = normalizeTrim(shipment.salesOrderId);
      if (soIdForMatch !== "") {
        const orderedByItem = getSalesOrderOrderedQtyByItemId(soIdForMatch);
        const shippedExcludingThis = aggregateShippedQtyByItemForSalesOrder(
          soIdForMatch,
          shipmentId,
        );
        for (const line of lines) {
          const itemIdTrimmed = normalizeTrim(line.itemId);
          if (itemIdTrimmed === "") continue;
          const ordered = orderedByItem.get(itemIdTrimmed);
          if (ordered === undefined) {
            const item = itemRepository.getById(itemIdTrimmed);
            const code = item?.code ?? itemIdTrimmed;
            issues.push(
              actionIssue(`Item ${code} is not on the related sales order.`),
            );
            continue;
          }
          const already = shippedExcludingThis.get(itemIdTrimmed) ?? 0;
          const q = parseDocumentLineQty(line.qty);
          if (q === null) continue;
          if (already + q > ordered) {
            const item = itemRepository.getById(itemIdTrimmed);
            const code = item?.code ?? itemIdTrimmed;
            issues.push(
              actionIssue(
                `Item ${code}: shipment quantity exceeds remaining to ship (ordered ${ordered}, already shipped ${already}, this shipment ${q}).`,
              ),
            );
          }
        }
      }

      for (const line of lines) {
        const qty = parseDocumentLineQty(line.qty) ?? 0;
        const balance = stockBalanceRepository.getByItemAndWarehouse(
          line.itemId,
          shipment.warehouseId,
        );
        const onHand = balance?.qtyOnHand ?? 0;
        const item = itemRepository.getById(line.itemId);
        const code = item?.code ?? line.itemId;
        if (onHand < qty) {
          issues.push(
            actionIssue(
              `Item ${code}: insufficient stock to post (available ${onHand}, required ${qty}).`,
            ),
          );
        } else if (onHand === qty && qty > 0) {
          issues.push(
            actionWarning(
              `Item ${code}: no buffer remaining (shipped quantity equals available stock).`,
            ),
          );
        }
      }
    }
  }

  return issues;
}

export function post(shipmentId: string): PostResult {
  const issues = validateShipmentFull(shipmentId);
  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) return { success: false, issues };

  const shipment = shipmentRepository.getById(shipmentId)!;
  const lines = shipmentRepository.listLines(shipmentId);
  const now = new Date().toISOString();

  for (const line of lines) {
    stockMovementRepository.create({
      datetime: now,
      movementType: "shipment",
      itemId: line.itemId,
      warehouseId: shipment.warehouseId,
      qtyDelta: -line.qty,
      sourceDocumentType: "shipment",
      sourceDocumentId: shipmentId,
    });

    const existing = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      shipment.warehouseId,
    );
    const newQty = Math.max(0, (existing?.qtyOnHand ?? 0) - line.qty);
    stockBalanceRepository.upsert({
      itemId: line.itemId,
      warehouseId: shipment.warehouseId,
      qtyOnHand: newQty,
    });
  }

  const prevStatus = shipment.status;
  shipmentRepository.update(shipmentId, { status: "posted" });
  const soFulfillment = computeSalesOrderFulfillment(shipment.salesOrderId);
  salesOrderRepository.update(shipment.salesOrderId, {
    status: soFulfillment.state === "complete" ? "closed" : "confirmed",
  });
  appendAuditEvent({
    entityType: "shipment",
    entityId: shipmentId,
    eventType: "document_posted",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: shipment.number,
      previousStatus: prevStatus,
      newStatus: "posted" as const,
      salesOrderId: shipment.salesOrderId,
    },
  });
  return { success: true };
}

export function cancelDocument(
  shipmentId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const reasonErr = validateCancelDocumentReasonForm(input.cancelReasonCode);
  if (reasonErr) return { success: false, error: reasonErr };
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return { success: false, error: "Shipment not found." };
  if (shipment.status !== "draft")
    return { success: false, error: "Only draft shipments can be cancelled." };
  const code = input.cancelReasonCode as CancelDocumentReasonCode;
  const comment = normalizeCancelReasonComment(input.cancelReasonComment);
  const prevStatus = shipment.status;
  shipmentRepository.update(shipmentId, {
    status: "cancelled",
    cancelReasonCode: code,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  appendAuditEvent({
    entityType: "shipment",
    entityId: shipmentId,
    eventType: "document_cancelled",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: shipment.number,
      previousStatus: prevStatus,
      newStatus: "cancelled" as const,
      cancelReasonCode: code,
      cancelReasonComment: comment ?? null,
    },
  });
  return { success: true };
}

/**
 * Full reversal of a posted shipment: compensating stock movements (shipment_reversal),
 * balances increased, status → reversed, linked SO reopened to confirmed. One-time only.
 */
export function reverseDocument(
  shipmentId: string,
  input: ReversalDocumentReasonInput,
): ReverseDocumentResult {
  const reasonErr = validateReversalDocumentReasonForm(input.reversalReasonCode);
  if (reasonErr) return { success: false, error: reasonErr };

  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return { success: false, error: "Shipment not found." };
  if (shipment.status === "reversed") {
    return { success: false, error: "This shipment is already reversed." };
  }
  if (shipment.status !== "posted") {
    return { success: false, error: "Only posted shipments can be reversed." };
  }

  const lines = shipmentRepository.listLines(shipmentId);
  if (lines.length === 0) {
    return { success: false, error: "Shipment has no lines; cannot reverse." };
  }

  for (const line of lines) {
    const qty = parseDocumentLineQty(line.qty);
    if (qty === null) {
      return { success: false, error: "One or more lines have invalid quantity for reversal." };
    }
  }

  const now = new Date().toISOString();
  const code = input.reversalReasonCode as ReversalDocumentReasonCode;
  const revComment = normalizeReversalReasonComment(input.reversalReasonComment);

  for (const line of lines) {
    const qty = parseDocumentLineQty(line.qty)!;
    stockMovementRepository.create({
      datetime: now,
      movementType: "shipment_reversal",
      itemId: line.itemId,
      warehouseId: shipment.warehouseId,
      qtyDelta: qty,
      sourceDocumentType: "shipment",
      sourceDocumentId: shipmentId,
      comment: "Shipment reversal (compensating movement)",
    });
    const existing = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      shipment.warehouseId,
    );
    const newQty = (existing?.qtyOnHand ?? 0) + qty;
    stockBalanceRepository.upsert({
      itemId: line.itemId,
      warehouseId: shipment.warehouseId,
      qtyOnHand: newQty,
    });
  }

  const prevStatus = shipment.status;
  shipmentRepository.update(shipmentId, {
    status: "reversed",
    reversalReasonCode: code,
    ...(revComment !== undefined ? { reversalReasonComment: revComment } : {}),
  });

  salesOrderRepository.update(shipment.salesOrderId, { status: "confirmed" });

  appendAuditEvent({
    entityType: "shipment",
    entityId: shipmentId,
    eventType: "document_reversed",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: shipment.number,
      previousStatus: prevStatus,
      newStatus: "reversed" as const,
      reversalReasonCode: code,
      reversalReasonComment: revComment ?? null,
      movementLineCount: lines.length,
      salesOrderId: shipment.salesOrderId,
    },
  });

  return { success: true };
}

export const shipmentService = {
  post,
  cancelDocument,
  reverseDocument,
};
