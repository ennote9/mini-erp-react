import { itemRepository } from "@/modules/items/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { receiptRepository } from "@/modules/receipts/repository";
import { shipmentRepository } from "@/modules/shipments/repository";
import { salesOrderRepository } from "@/modules/sales-orders/repository";
import { purchaseOrderRepository } from "@/modules/purchase-orders/repository";
import { stockMovementRepository } from "./repository";
import type { StockMovement } from "./model";
import type { SourceDocumentType } from "@/shared/domain";

const EMPTY_RELATED_ORDER = "\u2014";

export type StockMovementListRow = StockMovement & {
  itemCode: string;
  itemName: string;
  warehouseName: string;
  sourceDocumentLabel: string;
  sourceDocumentHref: string | null;
  relatedOrderLabel: string;
  relatedOrderHref: string | null;
};

/** Display only the source document number/code; movement type is a separate column. */
export function getSourceDocument(
  sourceDocumentType: SourceDocumentType,
  sourceDocumentId: string,
): { label: string; href: string | null } {
  if (sourceDocumentType === "receipt") {
    const doc = receiptRepository.getById(sourceDocumentId);
    const number = doc?.number ?? sourceDocumentId;
    return {
      label: number,
      href: `/receipts/${sourceDocumentId}`,
    };
  }
  if (sourceDocumentType === "shipment") {
    const doc = shipmentRepository.getById(sourceDocumentId);
    const number = doc?.number ?? sourceDocumentId;
    return {
      label: number,
      href: `/shipments/${sourceDocumentId}`,
    };
  }
  return { label: sourceDocumentId, href: null };
}

/**
 * Related planning order for the movement: SO from posted shipment, PO from posted receipt.
 * Reversal movements use the same source document id, so linkage matches the underlying receipt/shipment.
 */
export function getRelatedOrderDisplay(
  sourceDocumentType: SourceDocumentType,
  sourceDocumentId: string,
): { label: string; href: string | null } {
  if (sourceDocumentType === "shipment") {
    const sh = shipmentRepository.getById(sourceDocumentId);
    const soId = sh?.salesOrderId?.trim() ?? "";
    if (soId === "") return { label: EMPTY_RELATED_ORDER, href: null };
    const so = salesOrderRepository.getById(soId);
    const num = so?.number?.trim() ?? "";
    if (num === "") return { label: EMPTY_RELATED_ORDER, href: null };
    return { label: num, href: `/sales-orders/${soId}` };
  }
  if (sourceDocumentType === "receipt") {
    const rc = receiptRepository.getById(sourceDocumentId);
    const poId = rc?.purchaseOrderId?.trim() ?? "";
    if (poId === "") return { label: EMPTY_RELATED_ORDER, href: null };
    const po = purchaseOrderRepository.getById(poId);
    const num = po?.number?.trim() ?? "";
    if (num === "") return { label: EMPTY_RELATED_ORDER, href: null };
    return { label: num, href: `/purchase-orders/${poId}` };
  }
  return { label: EMPTY_RELATED_ORDER, href: null };
}

export function buildStockMovementListRows(): StockMovementListRow[] {
  const list = stockMovementRepository.list();
  return list
    .map((m) => {
      const item = itemRepository.getById(m.itemId);
      const warehouse = warehouseRepository.getById(m.warehouseId);
      const { label: sourceDocumentLabel, href: sourceDocumentHref } = getSourceDocument(
        m.sourceDocumentType,
        m.sourceDocumentId,
      );
      const { label: relatedOrderLabel, href: relatedOrderHref } = getRelatedOrderDisplay(
        m.sourceDocumentType,
        m.sourceDocumentId,
      );
      return {
        ...m,
        itemCode: item?.code ?? m.itemId,
        itemName: item?.name ?? m.itemId,
        warehouseName: warehouse?.name ?? m.warehouseId,
        sourceDocumentLabel,
        sourceDocumentHref,
        relatedOrderLabel,
        relatedOrderHref,
      };
    })
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
}
