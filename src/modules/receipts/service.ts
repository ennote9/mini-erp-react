import type { Issue } from "../../shared/issues";
import { actionIssue } from "../../shared/issues";
import { flushPendingReceiptPersist, receiptRepository } from "./repository";
import {
  flushPendingPurchaseOrderPersist,
  purchaseOrderRepository,
} from "../purchase-orders/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import {
  flushPendingStockMovementPersist,
  stockMovementRepository,
} from "../stock-movements/repository";
import {
  flushPendingStockBalancePersist,
  stockBalanceRepository,
} from "../stock-balances/repository";
import { parseDocumentLineQty } from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";
import {
  resolveCancelDocumentReasonForService,
  resolveReversalDocumentReasonForService,
  type CancelDocumentReasonInput,
  type ReversalDocumentReasonInput,
} from "../../shared/reasonCodes";
import { getAppSettings } from "../../shared/settings/store";
import {
  appendAuditEvent,
  flushPendingAuditEventPersist,
} from "../../shared/audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "../../shared/audit/eventLogTypes";
import { DEFAULT_STOCK_STYLE } from "@/shared/inventoryStyle";
import {
  goodsStyleAllowedInWarehousePolicy,
  itemUsesGoodsProcessMatrix,
} from "@/shared/inventoryProcessMatrix";
import {
  aggregateReceivedQtyByItemForPurchaseOrder,
  computePurchaseOrderFulfillment,
  getPurchaseOrderOrderedQtyByItemId,
} from "../../shared/planningFulfillment";

export type PostResult = { success: true } | { success: false; issues: Issue[] };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

export type ReverseDocumentResult =
  | { success: true }
  | { success: false; error: string };

function persistenceErrorMessage(error: unknown, prefix: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}

async function flushReceiptCriticalPersistence(): Promise<void> {
  const settled = await Promise.allSettled([
    flushPendingStockMovementPersist(),
    flushPendingStockBalancePersist(),
    flushPendingReceiptPersist(),
    flushPendingPurchaseOrderPersist(),
    flushPendingAuditEventPersist(),
  ]);
  const failures = settled.flatMap((result) => {
    if (result.status === "fulfilled") return [];
    return [result.reason instanceof Error ? result.reason.message : String(result.reason)];
  });
  if (failures.length > 0) {
    throw new Error(failures.join(" | "));
  }
}

/**
 * Full-pass validation for a receipt (draft factual document).
 * Collects all blocking issues without stopping at the first — mirrors shipment validation style.
 */
export function validateReceiptFull(receiptId: string): Issue[] {
  const issues: Issue[] = [];
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) {
    issues.push(
      actionIssue("Receipt not found.", { key: "issues.receipt.notFound" }),
    );
    return issues;
  }
  if (receipt.status !== "draft") {
    issues.push(
      actionIssue("Only draft receipts can be posted.", {
        key: "issues.receipt.onlyDraftPost",
      }),
    );
    return issues;
  }

  const poIdTrimmed = normalizeTrim(receipt.purchaseOrderId);
  if (poIdTrimmed === "") {
    issues.push(
      actionIssue("Related purchase order is required.", {
        key: "issues.receipt.poRequired",
      }),
    );
  } else {
    const po = purchaseOrderRepository.getById(poIdTrimmed);
    if (!po) {
      issues.push(
        actionIssue("Related purchase order is required.", {
          key: "issues.receipt.poRequired",
        }),
      );
    } else if (po.status !== "confirmed") {
      issues.push(
        actionIssue("Related purchase order must be confirmed before posting.", {
          key: "issues.receipt.poMustBeConfirmed",
        }),
      );
    }
  }

  const warehouseIdTrimmed = normalizeTrim(receipt.warehouseId);
  if (warehouseIdTrimmed === "") {
    issues.push(
      actionIssue("Warehouse is required.", {
        key: "issues.receipt.warehouseRequired",
      }),
    );
  } else {
    const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
    if (!warehouse) {
      issues.push(
        actionIssue("Warehouse is required.", {
          key: "issues.receipt.warehouseRequired",
        }),
      );
    } else if (!warehouse.isActive) {
      issues.push(
        actionIssue("Selected warehouse is inactive.", {
          key: "issues.receipt.warehouseInactive",
        }),
      );
    }
  }

  const lines = receiptRepository.listLines(receiptId);
  const warehouse =
    warehouseIdTrimmed !== "" ? warehouseRepository.getById(warehouseIdTrimmed) : undefined;
  if (!lines || lines.length === 0) {
    issues.push(
      actionIssue("At least one line is required.", {
        key: "issues.receipt.linesRequired",
      }),
    );
  } else {
    const itemIds = new Set<string>();
    for (const line of lines) {
      const itemIdTrimmed = normalizeTrim(line.itemId);
      if (itemIdTrimmed === "") {
        issues.push(
          actionIssue("Each line must have an item.", {
            key: "issues.receipt.lineNeedsItem",
          }),
        );
        continue;
      }
      const qty = parseDocumentLineQty(line.qty);
      if (qty === null) {
        issues.push(
          actionIssue("Quantity must be greater than zero.", {
            key: "issues.receipt.qtyPositive",
          }),
        );
      }
      const item = itemRepository.getById(itemIdTrimmed);
      if (!item) {
        issues.push(
          actionIssue("Each line must have an item.", {
            key: "issues.receipt.lineNeedsItem",
          }),
        );
      } else if (!item.isActive) {
        issues.push(
          actionIssue("Selected item is inactive.", {
            key: "issues.receipt.itemInactive",
          }),
        );
      } else if (
        warehouse &&
        itemUsesGoodsProcessMatrix(item) &&
        !goodsStyleAllowedInWarehousePolicy(DEFAULT_STOCK_STYLE, warehouse.stylePolicy)
      ) {
        issues.push(
          actionIssue(
            `Item ${item.code}: warehouse ${warehouse.code} style policy does not allow receiving GOODS as GOOD stock.`,
          ),
        );
      }
      if (itemIds.has(itemIdTrimmed)) {
        issues.push(
          actionIssue("Duplicate items are not allowed in the same document.", {
            key: "issues.receipt.duplicateItems",
          }),
        );
      }
      itemIds.add(itemIdTrimmed);
    }

    if (receipt && poIdTrimmed !== "") {
      const orderedByItem = getPurchaseOrderOrderedQtyByItemId(poIdTrimmed);
      const receivedExcludingThis = aggregateReceivedQtyByItemForPurchaseOrder(
        poIdTrimmed,
        receiptId,
      );
      for (const line of lines) {
        const itemIdTrimmed = normalizeTrim(line.itemId);
        if (itemIdTrimmed === "") continue;
        const ordered = orderedByItem.get(itemIdTrimmed);
        if (ordered === undefined) {
          const item = itemRepository.getById(itemIdTrimmed);
          const code = item?.code ?? itemIdTrimmed;
          issues.push(
            actionIssue(`Item ${code} is not on the related purchase order.`, {
              key: "issues.receipt.itemNotOnPo",
              params: { code },
            }),
          );
          continue;
        }
        const already = receivedExcludingThis.get(itemIdTrimmed) ?? 0;
        const q = parseDocumentLineQty(line.qty);
        if (q === null) continue;
        if (already + q > ordered) {
          const item = itemRepository.getById(itemIdTrimmed);
          const code = item?.code ?? itemIdTrimmed;
          issues.push(
            actionIssue(
              `Item ${code}: receipt quantity exceeds remaining to receive (ordered ${ordered}, already received ${already}, this receipt ${q}).`,
              {
                key: "issues.receipt.qtyExceedsRemaining",
                params: {
                  code,
                  ordered,
                  already,
                  qty: q,
                },
              },
            ),
          );
        }
      }
    }
  }

  return issues;
}

export async function post(receiptId: string): Promise<PostResult> {
  const issues = validateReceiptFull(receiptId);
  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) return { success: false, issues };

  try {
    await flushReceiptCriticalPersistence();

    const receipt = receiptRepository.getById(receiptId)!;
    const lines = receiptRepository.listLines(receiptId);
    const now = new Date().toISOString();

    for (const line of lines) {
      stockMovementRepository.create({
        datetime: now,
        movementType: "receipt",
        itemId: line.itemId,
        warehouseId: receipt.warehouseId,
        style: DEFAULT_STOCK_STYLE,
        qtyDelta: line.qty,
        sourceDocumentType: "receipt",
        sourceDocumentId: receiptId,
      });

      stockBalanceRepository.adjustQty({
        itemId: line.itemId,
        warehouseId: receipt.warehouseId,
        style: DEFAULT_STOCK_STYLE,
        qtyDelta: line.qty,
      });
    }

    const prevStatus = receipt.status;
    receiptRepository.update(receiptId, { status: "posted" });
    const poFulfillment = computePurchaseOrderFulfillment(receipt.purchaseOrderId);
    const autoClose = getAppSettings().documents.autoClosePlanningOnFullFulfillment;
    const nextPoStatus =
      autoClose && poFulfillment.state === "complete" ? "closed" : "confirmed";
    purchaseOrderRepository.update(receipt.purchaseOrderId, {
      status: nextPoStatus,
    });
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

    await flushReceiptCriticalPersistence();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      issues: [actionIssue(persistenceErrorMessage(error, "Receipt post failed"))],
    };
  }
}

export function cancelDocument(
  receiptId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const resolved = resolveCancelDocumentReasonForService(
    input,
    getAppSettings().documents.requireCancelReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) return { success: false, error: "Receipt not found." };
  if (receipt.status !== "draft")
    return { success: false, error: "Only draft receipts can be cancelled." };
  const code = resolved.code;
  const comment = resolved.comment;
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
export async function reverseDocument(
  receiptId: string,
  input: ReversalDocumentReasonInput,
): Promise<ReverseDocumentResult> {
  const resolved = resolveReversalDocumentReasonForService(
    input,
    getAppSettings().documents.requireReversalReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };

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
      const itemCode = item?.code ?? line.itemId;
      return {
        success: false,
        error: `Item ${itemCode}: insufficient stock to reverse receipt (available ${onHand}, required ${qty}).`,
      };
    }
  }

  try {
    await flushReceiptCriticalPersistence();

    const now = new Date().toISOString();
    const reasonCode = resolved.code;
    const revComment = resolved.comment;

    for (const line of lines) {
      const qty = parseDocumentLineQty(line.qty)!;
      stockMovementRepository.create({
        datetime: now,
        movementType: "receipt_reversal",
        itemId: line.itemId,
        warehouseId: receipt.warehouseId,
        style: DEFAULT_STOCK_STYLE,
        qtyDelta: -qty,
        sourceDocumentType: "receipt",
        sourceDocumentId: receiptId,
        comment: "Receipt reversal (compensating movement)",
      });
      stockBalanceRepository.adjustQty({
        itemId: line.itemId,
        warehouseId: receipt.warehouseId,
        style: DEFAULT_STOCK_STYLE,
        qtyDelta: -qty,
      });
    }

    const prevStatus = receipt.status;
    receiptRepository.update(receiptId, {
      status: "reversed",
      reversalReasonCode: reasonCode,
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
        reversalReasonCode: reasonCode,
        reversalReasonComment: revComment ?? null,
        movementLineCount: lines.length,
        purchaseOrderId: receipt.purchaseOrderId,
      },
    });

    await flushReceiptCriticalPersistence();
    return { success: true };
  } catch (error) {
    return { success: false, error: persistenceErrorMessage(error, "Receipt reverse failed") };
  }
}

export const receiptService = {
  post,
  cancelDocument,
  reverseDocument,
};
