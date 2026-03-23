/**
 * Aggregated stock balances / movements for a set of items (e.g. by brand or category).
 */
import type { TFunction } from "@/shared/i18n/resolve";
import type { SourceDocumentType } from "@/shared/domain";
import { itemRepository } from "../modules/items/repository";
import type { ItemPageBalanceRow } from "../modules/items/itemInventoryRelated";
import { stockBalanceRepository } from "../modules/stock-balances/repository";
import { stockMovementRepository } from "../modules/stock-movements/repository";
import { warehouseRepository } from "../modules/warehouses/repository";
import { receiptRepository } from "../modules/receipts/repository";
import { shipmentRepository } from "../modules/shipments/repository";
import {
  buildOutgoingRemainingByWarehouseItem,
  buildIncomingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
} from "@/shared/stockBalancesOperationalMetrics";

type Acc = {
  warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
};

export function buildAggregatedWarehouseBalancesForItemIds(
  itemIds: Set<string>,
): ItemPageBalanceRow[] {
  if (itemIds.size === 0) return [];
  const outgoing = buildOutgoingRemainingByWarehouseItem();
  const incoming = buildIncomingRemainingByWarehouseItem();
  const acc = new Map<string, Acc>();
  for (const b of stockBalanceRepository.list()) {
    if (!itemIds.has(b.itemId)) continue;
    const op = computeOperationalFieldsForBalance(b, outgoing, incoming);
    const cur = acc.get(b.warehouseId);
    if (!cur) {
      acc.set(b.warehouseId, {
        warehouseId: b.warehouseId,
        qtyOnHand: b.qtyOnHand,
        reservedQty: op.reservedQty,
        availableQty: op.availableQty,
        outgoingQty: op.outgoingQty,
        incomingQty: op.incomingQty,
      });
    } else {
      cur.qtyOnHand += b.qtyOnHand;
      cur.reservedQty += op.reservedQty;
      cur.availableQty += op.availableQty;
      cur.outgoingQty += op.outgoingQty;
      cur.incomingQty += op.incomingQty;
    }
  }
  return [...acc.values()]
    .map((r) => ({
      warehouseId: r.warehouseId,
      warehouseName: warehouseRepository.getById(r.warehouseId)?.name ?? r.warehouseId,
      qtyOnHand: r.qtyOnHand,
      reservedQty: r.reservedQty,
      availableQty: r.availableQty,
      outgoingQty: r.outgoingQty,
      incomingQty: r.incomingQty,
    }))
    .sort((a, b) =>
      a.warehouseName.localeCompare(b.warehouseName, undefined, { sensitivity: "base" }),
    );
}

function sourceDocumentLabel(
  sourceDocumentType: SourceDocumentType,
  sourceDocumentId: string,
  translate: TFunction,
): string {
  if (sourceDocumentType === "receipt") {
    const doc = receiptRepository.getById(sourceDocumentId);
    const number = doc?.number ?? sourceDocumentId;
    return translate("ops.stockMovements.sourceReceipt", { number });
  }
  if (sourceDocumentType === "shipment") {
    const doc = shipmentRepository.getById(sourceDocumentId);
    const number = doc?.number ?? sourceDocumentId;
    return translate("ops.stockMovements.sourceShipment", { number });
  }
  return sourceDocumentId;
}

export type MasterScopeMovementRow = {
  id: string;
  datetime: string;
  movementTypeCode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  qtyDelta: number;
  sourceDocumentLabel: string;
};

export function buildRecentScopedMovementsForItemIds(
  itemIds: Set<string>,
  translate: TFunction,
  limit: number,
): MasterScopeMovementRow[] {
  if (itemIds.size === 0) return [];
  const list = stockMovementRepository
    .list()
    .filter((m) => itemIds.has(m.itemId))
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  return list.slice(0, limit).map((m) => {
    const item = itemRepository.getById(m.itemId);
    const wh = warehouseRepository.getById(m.warehouseId);
    return {
      id: m.id,
      datetime: m.datetime,
      movementTypeCode: m.movementType,
      itemId: m.itemId,
      itemCode: item?.code ?? m.itemId,
      itemName: item?.name ?? m.itemId,
      warehouseId: m.warehouseId,
      warehouseName: wh?.name ?? m.warehouseId,
      qtyDelta: m.qtyDelta,
      sourceDocumentLabel: sourceDocumentLabel(
        m.sourceDocumentType,
        m.sourceDocumentId,
        translate,
      ),
    };
  });
}
