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

export type PostResult = { success: true } | { success: false; issues: Issue[] };
export type CancelDocumentResult =
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
      const postedForSameSo = shipmentRepository
        .list()
        .some(
          (s) =>
            s.salesOrderId === shipment.salesOrderId &&
            s.id !== shipmentId &&
            s.status === "posted",
        );
      if (postedForSameSo) {
        issues.push(actionIssue("A posted shipment already exists for this sales order."));
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
              `Insufficient stock for item ${code}. Available: ${onHand}, required: ${qty}.`,
            ),
          );
        } else if (onHand === qty && qty > 0) {
          issues.push(
            actionWarning(
              `Item ${code}: no stock buffer (quantity equals available).`,
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

  shipmentRepository.update(shipmentId, { status: "posted" });
  salesOrderRepository.update(shipment.salesOrderId, { status: "closed" });
  return { success: true };
}

export function cancelDocument(shipmentId: string): CancelDocumentResult {
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return { success: false, error: "Shipment not found." };
  if (shipment.status !== "draft")
    return { success: false, error: "Only draft shipments can be cancelled." };
  shipmentRepository.update(shipmentId, { status: "cancelled" });
  return { success: true };
}

export const shipmentService = {
  post,
  cancelDocument,
};
