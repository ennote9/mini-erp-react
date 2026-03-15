import { shipmentRepository } from "./repository";
import { salesOrderRepository } from "../sales-orders/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { stockMovementRepository } from "../stock-movements/repository";
import { stockBalanceRepository } from "../stock-balances/repository";
import { validateDocumentLines, parseDocumentLineQty } from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";

export type PostResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

function validatePost(shipmentId: string): string | null {
  const shipment = shipmentRepository.getById(shipmentId);
  if (!shipment) return "Shipment not found.";
  if (shipment.status !== "draft")
    return "Only draft shipments can be posted.";

  const soIdTrimmed = normalizeTrim(shipment.salesOrderId);
  if (soIdTrimmed === "") return "Related sales order is required.";
  const so = salesOrderRepository.getById(soIdTrimmed);
  if (!so) return "Related sales order is required.";
  if (so.status !== "confirmed")
    return "Related sales order must be confirmed before posting.";

  const warehouseIdTrimmed = normalizeTrim(shipment.warehouseId);
  if (warehouseIdTrimmed === "") return "Warehouse is required.";
  const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
  if (!warehouse) return "Warehouse is required.";
  if (!warehouse.isActive) return "Selected warehouse is inactive.";

  const lines = shipmentRepository.listLines(shipmentId);
  const lineErr = validateDocumentLines(lines, itemRepository);
  if (lineErr) return lineErr;

  const postedForSameSo = shipmentRepository
    .list()
    .some(
      (s) =>
        s.salesOrderId === shipment.salesOrderId &&
        s.id !== shipmentId &&
        s.status === "posted",
    );
  if (postedForSameSo)
    return "A posted shipment already exists for this sales order.";

  for (const line of lines) {
    const qty = parseDocumentLineQty(line.qty) ?? 0;
    const balance = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      shipment.warehouseId,
    );
    const onHand = balance?.qtyOnHand ?? 0;
    if (onHand < qty) {
      const item = itemRepository.getById(line.itemId);
      const code = item?.code ?? line.itemId;
      return `Insufficient stock for item ${code}. Available: ${onHand}, required: ${qty}.`;
    }
  }

  return null;
}

export function post(shipmentId: string): PostResult {
  const err = validatePost(shipmentId);
  if (err) return { success: false, error: err };

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
