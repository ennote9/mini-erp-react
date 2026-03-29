import type { Issue } from "../../shared/issues";
import { actionIssue, actionWarning } from "../../shared/issues";
import { flushPendingShipmentPersist, shipmentRepository } from "./repository";
import {
  flushPendingSalesOrderPersist,
  salesOrderRepository,
} from "../sales-orders/repository";
import {
  flushPendingStockReservationPersist,
  stockReservationRepository,
} from "../stock-reservations/repository";
import { warehouseRepository } from "../warehouses/repository";
import { carrierRepository } from "../carriers/repository";
import { itemRepository } from "../items/repository";
import { markdownRepository } from "../markdown-journal/repository";
import {
  flushPendingStockMovementPersist,
  stockMovementRepository,
} from "../stock-movements/repository";
import {
  flushPendingStockBalancePersist,
  stockBalanceRepository,
} from "../stock-balances/repository";
import { parseDocumentLineQty } from "../../shared/documentValidation";
import { normalizeTrim, validatePhone } from "../../shared/validation";
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
import {
  aggregateShippedQtyByItemForSalesOrder,
  computeSalesOrderFulfillment,
  getSalesOrderOrderedQtyByItemId,
} from "../../shared/planningFulfillment";
import { reconcileSalesOrderReservations } from "../../shared/soReservationReconcile";
import { DEFAULT_STOCK_STYLE, type StockStyle } from "@/shared/inventoryStyle";
import {
  goodsStyleAllowedInWarehousePolicy,
  goodsStyleSupportsProcess,
  itemUsesGoodsProcessMatrix,
} from "@/shared/inventoryProcessMatrix";

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

async function flushShipmentCriticalPersistence(): Promise<void> {
  const settled = await Promise.allSettled([
    flushPendingStockReservationPersist(),
    flushPendingStockMovementPersist(),
    flushPendingStockBalancePersist(),
    flushPendingShipmentPersist(),
    flushPendingSalesOrderPersist(),
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

function lineStockStyle(markdownCode: string | undefined): StockStyle {
  if (!markdownCode) return DEFAULT_STOCK_STYLE;
  const markdownRecord = markdownRepository.getByCode(markdownCode.trim().toUpperCase());
  return markdownRecord?.style ?? "MARKDOWN";
}

/**
 * Full-pass validation: collect all errors (and warnings) for the shipment without stopping at the first.
 * Used for Post validation and for Document issues display.
 */
export function validateShipmentFull(shipmentId: string): Issue[] {
  const issues: Issue[] = [];
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) {
    issues.push(
      actionIssue("Shipment not found.", { key: "issues.shipment.notFound" }),
    );
    return issues;
  }
  if (shipment.status !== "draft") {
    issues.push(
      actionIssue("Only draft shipments can be posted.", {
        key: "issues.shipment.onlyDraftPost",
      }),
    );
    return issues;
  }

  const soIdTrimmed = normalizeTrim(shipment.salesOrderId);
  if (soIdTrimmed === "") {
    issues.push(
      actionIssue("Related sales order is required.", {
        key: "issues.shipment.soRequired",
      }),
    );
  } else {
    const so = salesOrderRepository.getById(soIdTrimmed);
    if (!so) {
      issues.push(
        actionIssue("Related sales order is required.", {
          key: "issues.shipment.soRequired",
        }),
      );
    } else if (so.status !== "confirmed") {
      issues.push(
        actionIssue("Related sales order must be confirmed before posting.", {
          key: "issues.shipment.soMustBeConfirmed",
        }),
      );
    } else {
      reconcileSalesOrderReservations(soIdTrimmed, {
        reason: "shipment_validation",
        emitAudit: false,
      });
      const sowh = normalizeTrim(so.warehouseId);
      const shwh = normalizeTrim(shipment.warehouseId);
      if (sowh !== "" && shwh !== "" && sowh !== shwh) {
        issues.push(
          actionIssue(
            "Shipment warehouse must match the related sales order warehouse.",
            { key: "issues.shipment.warehouseMismatchSo" },
          ),
        );
      }
    }
  }

  const warehouseIdTrimmed = normalizeTrim(shipment.warehouseId);
  if (warehouseIdTrimmed === "") {
    issues.push(
      actionIssue("Warehouse is required.", {
        key: "issues.shipment.warehouseRequired",
      }),
    );
  } else {
    const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
    if (!warehouse) {
      issues.push(
        actionIssue("Warehouse is required.", {
          key: "issues.shipment.warehouseRequired",
        }),
      );
    } else if (!warehouse.isActive) {
      issues.push(
        actionIssue("Selected warehouse is inactive.", {
          key: "issues.shipment.warehouseInactive",
        }),
      );
    }
  }

  const carrierIdTrimmed = normalizeTrim(shipment.carrierId ?? "");
  if (carrierIdTrimmed !== "") {
    const carrier = carrierRepository.getById(carrierIdTrimmed);
    if (!carrier) {
      issues.push(
        actionIssue("Selected carrier is not valid.", {
          key: "issues.shipment.invalidCarrierReference",
        }),
      );
    }
  }

  const lines = shipmentRepository.listLines(shipmentId);
  const shipmentWarehouse =
    warehouseIdTrimmed !== "" ? warehouseRepository.getById(warehouseIdTrimmed) : undefined;
  if (!lines || lines.length === 0) {
    issues.push(
      actionIssue("At least one line is required.", {
        key: "issues.shipment.linesRequired",
      }),
    );
  } else {
    const itemIds = new Set<string>();
    const markdownCodesInDocument = new Set<string>();
    const markdownCodesInPostedShipments = new Set<string>();
    for (const doc of shipmentRepository.list()) {
      if (doc.id === shipmentId || doc.status !== "posted") continue;
      for (const shippedLine of shipmentRepository.listLines(doc.id)) {
        if (shippedLine.markdownCode) {
          markdownCodesInPostedShipments.add(shippedLine.markdownCode.trim().toUpperCase());
        }
      }
    }
    for (const line of lines) {
      const itemIdTrimmed = normalizeTrim(line.itemId);
      if (itemIdTrimmed === "") {
        issues.push(
          actionIssue("Each line must have an item.", {
            key: "issues.shipment.lineNeedsItem",
          }),
        );
        continue;
      }
      const qty = parseDocumentLineQty(line.qty);
      if (qty === null) {
        issues.push(
          actionIssue("Quantity must be greater than zero.", {
            key: "issues.shipment.qtyPositive",
          }),
        );
      }
      if (line.markdownCode && qty !== 1) {
        issues.push(
          actionIssue("Markdown unit quantity must be exactly 1.", {
            key: "issues.shipment.markdownQtyMustBeOne",
          }),
        );
      }
      const item = itemRepository.getById(itemIdTrimmed);
      const lineStyle = lineStockStyle(line.markdownCode);
      if (!item) {
        issues.push(
          actionIssue("Each line must have an item.", {
            key: "issues.shipment.lineNeedsItem",
          }),
        );
      } else if (!item.isActive) {
        issues.push(
          actionIssue("Selected item is inactive.", {
            key: "issues.shipment.itemInactive",
          }),
        );
      } else if (itemUsesGoodsProcessMatrix(item) && !goodsStyleSupportsProcess(lineStyle, "shipment")) {
        issues.push(
          actionIssue(
            `Item ${item.code}: ${lineStyle} stock is not supported for normal shipment in GOODS matrix v1.`,
          ),
        );
      } else if (
        itemUsesGoodsProcessMatrix(item) &&
        shipmentWarehouse &&
        !goodsStyleAllowedInWarehousePolicy(lineStyle, shipmentWarehouse.stylePolicy)
      ) {
        issues.push(
          actionIssue(
            `Item ${item.code}: warehouse ${shipmentWarehouse.code} style policy does not allow ${lineStyle} stock for shipment.`,
          ),
        );
      }
      if (itemIds.has(itemIdTrimmed) && !line.markdownCode) {
        issues.push(
          actionIssue("Duplicate items are not allowed in the same document.", {
            key: "issues.shipment.duplicateItems",
          }),
        );
      }
      if (!line.markdownCode) {
        itemIds.add(itemIdTrimmed);
      }
      if (line.markdownCode) {
        const normalizedMdCode = line.markdownCode.trim().toUpperCase();
        const markdownRecord = markdownRepository.getByCode(normalizedMdCode);
        if (!markdownRecord) {
          issues.push(
            actionIssue("Selected markdown code is not found.", {
              key: "issues.shipment.markdownCodeNotFound",
              params: { code: normalizedMdCode },
            }),
          );
          continue;
        }
        if (markdownRecord.status !== "ACTIVE") {
          issues.push(
            actionIssue("Selected markdown code is not available for shipment.", {
              key: "issues.shipment.markdownUnavailable",
              params: { code: normalizedMdCode, status: markdownRecord.status },
            }),
          );
        }
        if (markdownRecord.itemId !== itemIdTrimmed) {
          issues.push(
            actionIssue("Markdown code does not match selected item.", {
              key: "issues.shipment.markdownItemMismatch",
              params: { code: normalizedMdCode },
            }),
          );
        }
        if (normalizeTrim(markdownRecord.warehouseId) !== normalizeTrim(shipment.warehouseId)) {
          issues.push(
            actionIssue("Markdown code belongs to another warehouse.", {
              key: "issues.shipment.markdownWarehouseMismatch",
              params: { code: normalizedMdCode },
            }),
          );
        }
        if (markdownCodesInDocument.has(normalizedMdCode)) {
          issues.push(
            actionIssue("Duplicate markdown codes are not allowed in one shipment.", {
              key: "issues.shipment.markdownDuplicateInDocument",
              params: { code: normalizedMdCode },
            }),
          );
        } else {
          markdownCodesInDocument.add(normalizedMdCode);
        }
        if (markdownCodesInPostedShipments.has(normalizedMdCode)) {
          issues.push(
            actionIssue("Markdown code is already shipped in a posted shipment.", {
              key: "issues.shipment.markdownAlreadyShipped",
              params: { code: normalizedMdCode },
            }),
          );
        }
      }
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
              actionIssue(`Item ${code} is not on the related sales order.`, {
                key: "issues.shipment.itemNotOnSo",
                params: { code },
              }),
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
                {
                  key: "issues.shipment.qtyExceedsRemaining",
                  params: { code, ordered, already, qty: q },
                },
              ),
            );
          }
        }

        for (const line of lines) {
          const itemIdTrimmed = normalizeTrim(line.itemId);
          if (itemIdTrimmed === "") continue;
          const q = parseDocumentLineQty(line.qty);
          if (q === null || q <= 0) continue;
          const reserved = stockReservationRepository.sumActiveQtyForSalesOrderItem(
            soIdForMatch,
            itemIdTrimmed,
            shipment.warehouseId,
          );
          if (reserved < q) {
            const item = itemRepository.getById(itemIdTrimmed);
            const code = item?.code ?? itemIdTrimmed;
            issues.push(
              actionIssue(
                `Item ${code}: insufficient reserved quantity to post (${reserved} reserved, ${q} required). Use Allocate stock on the related sales order.`,
                {
                  key: "issues.shipment.insufficientReserved",
                  params: { code, reserved, required: q },
                },
              ),
            );
          }
        }
      }

      for (const line of lines) {
        const qty = parseDocumentLineQty(line.qty) ?? 0;
        const balance = stockBalanceRepository.getByItemWarehouseAndStyle(
          line.itemId,
          shipment.warehouseId,
          lineStockStyle(line.markdownCode),
        );
        const onHand = balance?.qtyOnHand ?? 0;
        const item = itemRepository.getById(line.itemId);
        const code = item?.code ?? line.itemId;
        if (onHand < qty) {
          issues.push(
            actionIssue(
              `Item ${code}: insufficient stock to post (available ${onHand}, required ${qty}).`,
              {
                key: "issues.shipment.insufficientStockPost",
                params: { code, available: onHand, required: qty },
              },
            ),
          );
        } else if (onHand === qty && qty > 0) {
          issues.push(
            actionWarning(
              `Item ${code}: no buffer remaining (shipped quantity equals available stock).`,
              {
                key: "issues.shipment.noBufferWarning",
                params: { code },
              },
            ),
          );
        }
      }
    }
  }

  return issues;
}

export async function post(shipmentId: string): Promise<PostResult> {
  const issues = validateShipmentFull(shipmentId);
  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) return { success: false, issues };

  try {
    await flushShipmentCriticalPersistence();

    const shipment = shipmentRepository.getById(shipmentId)!;
    const lines = shipmentRepository.listLines(shipmentId);
    const now = new Date().toISOString();

    let totalReservationConsumed = 0;
    for (const line of lines) {
      const q = parseDocumentLineQty(line.qty) ?? 0;
      if (q <= 0) continue;
      const ok = stockReservationRepository.tryConsumeActiveForSalesOrderItem(
        shipment.salesOrderId,
        line.itemId,
        q,
        shipment.warehouseId,
      );
      if (!ok) {
        return {
          success: false,
          issues: [
            actionIssue(
              "Could not consume stock reservations. Refresh and try again, or re-allocate on the sales order.",
              { key: "issues.shipment.reservationConsumeFailed" },
            ),
          ],
        };
      }
      totalReservationConsumed += q;
    }

    if (totalReservationConsumed > 0) {
      const soDoc = salesOrderRepository.getById(shipment.salesOrderId);
      appendAuditEvent({
        entityType: "sales_order",
        entityId: shipment.salesOrderId,
        eventType: "reservation_consumed",
        actor: AUDIT_ACTOR_LOCAL_USER,
        payload: {
          documentNumber: soDoc?.number ?? "",
          consumedQty: totalReservationConsumed,
          shipmentId,
          shipmentNumber: shipment.number,
        },
      });
    }

    for (const line of lines) {
      stockMovementRepository.create({
        datetime: now,
        movementType: "shipment",
        itemId: line.itemId,
        warehouseId: shipment.warehouseId,
        style: lineStockStyle(line.markdownCode),
        qtyDelta: -line.qty,
        sourceDocumentType: "shipment",
        sourceDocumentId: shipmentId,
      });

      stockBalanceRepository.adjustQty({
        itemId: line.itemId,
        warehouseId: shipment.warehouseId,
        style: lineStockStyle(line.markdownCode),
        qtyDelta: -line.qty,
      });
    }

    const prevStatus = shipment.status;
    shipmentRepository.update(shipmentId, { status: "posted" });
    const soFulfillment = computeSalesOrderFulfillment(shipment.salesOrderId);
    const nextSoStatus = soFulfillment.state === "complete" ? "closed" : "confirmed";
    salesOrderRepository.update(shipment.salesOrderId, {
      status: nextSoStatus,
    });
    if (
      nextSoStatus === "closed" &&
      getAppSettings().inventory.releaseReservationsOnSalesOrderClose
    ) {
      reconcileSalesOrderReservations(shipment.salesOrderId, { reason: "sales_order_closed" });
    }
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

    await flushShipmentCriticalPersistence();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      issues: [actionIssue(persistenceErrorMessage(error, "Shipment post failed"))],
    };
  }
}

export function cancelDocument(
  shipmentId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const resolved = resolveCancelDocumentReasonForService(
    input,
    getAppSettings().documents.requireCancelReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return { success: false, error: "Shipment not found." };
  if (shipment.status !== "draft")
    return { success: false, error: "Only draft shipments can be cancelled." };
  const code = resolved.code;
  const comment = resolved.comment;
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
export async function reverseDocument(
  shipmentId: string,
  input: ReversalDocumentReasonInput,
): Promise<ReverseDocumentResult> {
  const resolved = resolveReversalDocumentReasonForService(
    input,
    getAppSettings().documents.requireReversalReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };

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

  try {
    await flushShipmentCriticalPersistence();

    const now = new Date().toISOString();
    const reasonCode = resolved.code;
    const revComment = resolved.comment;

    for (const line of lines) {
      const qty = parseDocumentLineQty(line.qty)!;
      stockMovementRepository.create({
        datetime: now,
        movementType: "shipment_reversal",
        itemId: line.itemId,
        warehouseId: shipment.warehouseId,
        style: lineStockStyle(line.markdownCode),
        qtyDelta: qty,
        sourceDocumentType: "shipment",
        sourceDocumentId: shipmentId,
        comment: "Shipment reversal (compensating movement)",
      });
      stockBalanceRepository.adjustQty({
        itemId: line.itemId,
        warehouseId: shipment.warehouseId,
        style: lineStockStyle(line.markdownCode),
        qtyDelta: qty,
      });
    }

    const prevStatus = shipment.status;
    shipmentRepository.update(shipmentId, {
      status: "reversed",
      reversalReasonCode: reasonCode,
      ...(revComment !== undefined ? { reversalReasonComment: revComment } : {}),
    });

    salesOrderRepository.update(shipment.salesOrderId, { status: "confirmed" });

    reconcileSalesOrderReservations(shipment.salesOrderId, { reason: "shipment_reversal" });

    appendAuditEvent({
      entityType: "shipment",
      entityId: shipmentId,
      eventType: "document_reversed",
      actor: AUDIT_ACTOR_LOCAL_USER,
      payload: {
        documentNumber: shipment.number,
        previousStatus: prevStatus,
        newStatus: "reversed" as const,
        reversalReasonCode: reasonCode,
        reversalReasonComment: revComment ?? null,
        movementLineCount: lines.length,
        salesOrderId: shipment.salesOrderId,
      },
    });

    await flushShipmentCriticalPersistence();
    return { success: true };
  } catch (error) {
    return { success: false, error: persistenceErrorMessage(error, "Shipment reverse failed") };
  }
}

export type UpdateShipmentDraftLogisticsInput = {
  carrierId?: string;
  trackingNumber?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  deliveryComment?: string;
};

export type UpdateShipmentDraftLogisticsResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Phase-1: persist optional carrier + tracking on draft shipments only.
 */
export function updateShipmentDraftLogistics(
  shipmentId: string,
  input: UpdateShipmentDraftLogisticsInput,
): UpdateShipmentDraftLogisticsResult {
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return { success: false, error: "Shipment not found." };
  if (shipment.status !== "draft") {
    return { success: false, error: "Only draft shipments can be edited." };
  }

  const carrierRaw = input.carrierId != null ? normalizeTrim(input.carrierId) : "";
  const carrierId = carrierRaw === "" ? undefined : carrierRaw;
  if (carrierId !== undefined) {
    const c = carrierRepository.getById(carrierId);
    if (!c) return { success: false, error: "Selected carrier is not valid." };
  }

  const trRaw = input.trackingNumber != null ? normalizeTrim(input.trackingNumber) : "";
  const trackingNumber = trRaw === "" ? undefined : trRaw;

  const nameRaw = input.recipientName != null ? normalizeTrim(input.recipientName) : "";
  const recipientName = nameRaw === "" ? undefined : nameRaw;

  const phoneErr = validatePhone(
    input.recipientPhone != null ? normalizeTrim(input.recipientPhone) : undefined,
  );
  if (phoneErr) {
    return { success: false, error: phoneErr };
  }
  const phoneRaw = input.recipientPhone != null ? normalizeTrim(input.recipientPhone) : "";
  const recipientPhone = phoneRaw === "" ? undefined : phoneRaw;

  const addrRaw = input.deliveryAddress != null ? normalizeTrim(input.deliveryAddress) : "";
  const deliveryAddress = addrRaw === "" ? undefined : addrRaw;

  const delCommentRaw =
    input.deliveryComment != null ? normalizeTrim(input.deliveryComment) : "";
  const deliveryComment = delCommentRaw === "" ? undefined : delCommentRaw;

  shipmentRepository.update(shipmentId, {
    carrierId,
    trackingNumber,
    recipientName,
    recipientPhone,
    deliveryAddress,
    deliveryComment,
  });
  return { success: true };
}

export const shipmentService = {
  post,
  cancelDocument,
  reverseDocument,
  updateShipmentDraftLogistics,
};
