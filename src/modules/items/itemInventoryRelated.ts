import type { TFunction } from "@/shared/i18n/resolve";
import type { SourceDocumentType } from "@/shared/domain";
import { stockBalanceRepository } from "../stock-balances/repository";
import { stockMovementRepository } from "../stock-movements/repository";
import { warehouseRepository } from "../warehouses/repository";
import { receiptRepository } from "../receipts/repository";
import { shipmentRepository } from "../shipments/repository";
import {
  buildOutgoingRemainingByWarehouseItem,
  buildIncomingRemainingByWarehouseItem,
  computeOperationalFieldsForBalance,
} from "@/shared/stockBalancesOperationalMetrics";

export const ITEM_RECENT_MOVEMENTS_LIMIT = 15;

export type ItemPageBalanceRow = {
  warehouseId: string;
  warehouseName: string;
  qtyOnHand: number;
  reservedQty: number;
  availableQty: number;
  outgoingQty: number;
  incomingQty: number;
};

export type ItemPageBalanceSummary = {
  warehouseCount: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  totalOutgoing: number;
  totalIncoming: number;
};

export function buildItemPageBalanceRows(itemId: string): ItemPageBalanceRow[] {
  const outgoing = buildOutgoingRemainingByWarehouseItem();
  const incoming = buildIncomingRemainingByWarehouseItem();
  const list = stockBalanceRepository.list().filter((b) => b.itemId === itemId);
  return list
    .map((b) => {
      const wh = warehouseRepository.getById(b.warehouseId);
      const op = computeOperationalFieldsForBalance(b, outgoing, incoming);
      return {
        warehouseId: b.warehouseId,
        warehouseName: wh?.name ?? b.warehouseId,
        qtyOnHand: b.qtyOnHand,
        reservedQty: op.reservedQty,
        availableQty: op.availableQty,
        outgoingQty: op.outgoingQty,
        incomingQty: op.incomingQty,
      };
    })
    .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, undefined, { sensitivity: "base" }));
}

export function summarizeItemPageBalances(rows: ItemPageBalanceRow[]): ItemPageBalanceSummary {
  let totalOnHand = 0;
  let totalReserved = 0;
  let totalAvailable = 0;
  let totalOutgoing = 0;
  let totalIncoming = 0;
  for (const r of rows) {
    totalOnHand += r.qtyOnHand;
    totalReserved += r.reservedQty;
    totalAvailable += r.availableQty;
    totalOutgoing += r.outgoingQty;
    totalIncoming += r.incomingQty;
  }
  return {
    warehouseCount: rows.length,
    totalOnHand,
    totalReserved,
    totalAvailable,
    totalOutgoing,
    totalIncoming,
  };
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

export type ItemPageMovementRow = {
  id: string;
  datetime: string;
  movementTypeCode: string;
  warehouseId: string;
  warehouseName: string;
  qtyDelta: number;
  sourceDocumentLabel: string;
};

export function buildRecentItemPageMovements(
  itemId: string,
  translate: TFunction,
  limit: number,
): ItemPageMovementRow[] {
  const list = stockMovementRepository
    .list()
    .filter((m) => m.itemId === itemId)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  return list.slice(0, limit).map((m) => {
    const wh = warehouseRepository.getById(m.warehouseId);
    return {
      id: m.id,
      datetime: m.datetime,
      movementTypeCode: m.movementType,
      warehouseId: m.warehouseId,
      warehouseName: wh?.name ?? m.warehouseId,
      qtyDelta: m.qtyDelta,
      sourceDocumentLabel: sourceDocumentLabel(m.sourceDocumentType, m.sourceDocumentId, translate),
    };
  });
}
