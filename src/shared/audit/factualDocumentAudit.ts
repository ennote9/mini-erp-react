import { itemRepository } from "../../modules/items/repository";
import type { Receipt } from "../../modules/receipts/model";
import { receiptRepository } from "../../modules/receipts/repository";
import type { Shipment } from "../../modules/shipments/model";
import { shipmentRepository } from "../../modules/shipments/repository";
import { appendAuditEvent } from "./eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "./eventLogTypes";

function itemCode(id: string): string {
  return itemRepository.getById(id)?.code ?? id;
}

export function auditReceiptDocumentCreated(receipt: Receipt): void {
  const lines = receiptRepository.listLines(receipt.id);
  appendAuditEvent({
    entityType: "receipt",
    entityId: receipt.id,
    eventType: "document_created",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: receipt.number,
      status: receipt.status,
      purchaseOrderId: receipt.purchaseOrderId,
      warehouseId: receipt.warehouseId,
      lineCount: lines.length,
      lines: lines.map((l) => ({
        lineId: l.id,
        itemId: l.itemId,
        itemCode: itemCode(l.itemId),
        qty: l.qty,
      })),
    },
  });
}

export function auditShipmentDocumentCreated(shipment: Shipment): void {
  const lines = shipmentRepository.listLines(shipment.id);
  appendAuditEvent({
    entityType: "shipment",
    entityId: shipment.id,
    eventType: "document_created",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: shipment.number,
      status: shipment.status,
      salesOrderId: shipment.salesOrderId,
      warehouseId: shipment.warehouseId,
      lineCount: lines.length,
      lines: lines.map((l) => ({
        lineId: l.id,
        itemId: l.itemId,
        itemCode: itemCode(l.itemId),
        qty: l.qty,
      })),
    },
  });
}
