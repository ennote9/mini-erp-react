/**
 * Read-only aggregations for the operational dashboard from local repositories.
 */
import { purchaseOrderRepository } from "../purchase-orders/repository";
import { salesOrderRepository } from "../sales-orders/repository";
import { receiptRepository } from "../receipts/repository";
import { shipmentRepository } from "../shipments/repository";
import { stockBalanceRepository } from "../stock-balances/repository";
import { stockMovementRepository } from "../stock-movements/repository";
import { itemRepository } from "../items/repository";
import { warehouseRepository } from "../warehouses/repository";
import type {
  FactualDocumentStatus,
  PlanningDocumentStatus,
} from "../../shared/domain";

export type PlanningBreakdown = {
  total: number;
  draft: number;
  confirmed: number;
  closed: number;
  cancelled: number;
};

export type FactualBreakdown = {
  total: number;
  draft: number;
  posted: number;
  reversed: number;
  cancelled: number;
};

function countPlanningStatus(
  list: { status: PlanningDocumentStatus }[],
  status: PlanningDocumentStatus,
): number {
  return list.filter((x) => x.status === status).length;
}

function countFactualStatus(
  list: { status: FactualDocumentStatus }[],
  status: FactualDocumentStatus,
): number {
  return list.filter((x) => x.status === status).length;
}

export function getPurchaseOrderBreakdown(): PlanningBreakdown {
  const list = purchaseOrderRepository.list();
  return {
    total: list.length,
    draft: countPlanningStatus(list, "draft"),
    confirmed: countPlanningStatus(list, "confirmed"),
    closed: countPlanningStatus(list, "closed"),
    cancelled: countPlanningStatus(list, "cancelled"),
  };
}

export function getSalesOrderBreakdown(): PlanningBreakdown {
  const list = salesOrderRepository.list();
  return {
    total: list.length,
    draft: countPlanningStatus(list, "draft"),
    confirmed: countPlanningStatus(list, "confirmed"),
    closed: countPlanningStatus(list, "closed"),
    cancelled: countPlanningStatus(list, "cancelled"),
  };
}

export function getReceiptBreakdown(): FactualBreakdown {
  const list = receiptRepository.list();
  return {
    total: list.length,
    draft: countFactualStatus(list, "draft"),
    posted: countFactualStatus(list, "posted"),
    reversed: countFactualStatus(list, "reversed"),
    cancelled: countFactualStatus(list, "cancelled"),
  };
}

export function getShipmentBreakdown(): FactualBreakdown {
  const list = shipmentRepository.list();
  return {
    total: list.length,
    draft: countFactualStatus(list, "draft"),
    posted: countFactualStatus(list, "posted"),
    reversed: countFactualStatus(list, "reversed"),
    cancelled: countFactualStatus(list, "cancelled"),
  };
}

export type InventoryOverview = {
  balanceRows: number;
  movementRows: number;
  itemsTotal: number;
  itemsActive: number;
  itemsWithImages: number;
};

export function getInventoryOverview(): InventoryOverview {
  const items = itemRepository.list();
  const withImages = items.filter(
    (i) => Array.isArray(i.images) && i.images.length > 0,
  ).length;
  return {
    balanceRows: stockBalanceRepository.list().length,
    movementRows: stockMovementRepository.list().length,
    itemsTotal: items.length,
    itemsActive: items.filter((i) => i.isActive).length,
    itemsWithImages: withImages,
  };
}

export type RecentReceiptRow = {
  id: string;
  number: string;
  date: string;
  status: FactualDocumentStatus;
  purchaseOrderNumber: string;
  warehouseName: string;
};

export function getRecentReceipts(limit = 8): RecentReceiptRow[] {
  return receiptRepository
    .list()
    .slice()
    .sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) return db.localeCompare(da);
      return b.number.localeCompare(a.number, undefined, { numeric: true });
    })
    .slice(0, limit)
    .map((r) => {
      const po = purchaseOrderRepository.getById(r.purchaseOrderId);
      const wh = warehouseRepository.getById(r.warehouseId);
      return {
        id: r.id,
        number: r.number,
        date: r.date,
        status: r.status,
        purchaseOrderNumber: po?.number ?? r.purchaseOrderId,
        warehouseName: wh?.name ?? r.warehouseId,
      };
    });
}

export type RecentShipmentRow = {
  id: string;
  number: string;
  date: string;
  status: FactualDocumentStatus;
  salesOrderNumber: string;
  warehouseName: string;
};

export function getRecentShipments(limit = 8): RecentShipmentRow[] {
  return shipmentRepository
    .list()
    .slice()
    .sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) return db.localeCompare(da);
      return b.number.localeCompare(a.number, undefined, { numeric: true });
    })
    .slice(0, limit)
    .map((s) => {
      const so = salesOrderRepository.getById(s.salesOrderId);
      const wh = warehouseRepository.getById(s.warehouseId);
      return {
        id: s.id,
        number: s.number,
        date: s.date,
        status: s.status,
        salesOrderNumber: so?.number ?? s.salesOrderId,
        warehouseName: wh?.name ?? s.warehouseId,
      };
    });
}

export type DashboardSignals = {
  inactiveItems: number;
  itemsWithoutImages: number;
  draftReceipts: number;
  draftShipments: number;
};

export function getDashboardSignals(): DashboardSignals {
  const items = itemRepository.list();
  const inactiveItems = items.filter((i) => !i.isActive).length;
  const itemsWithoutImages = items.filter(
    (i) => !Array.isArray(i.images) || i.images.length === 0,
  ).length;
  return {
    inactiveItems,
    itemsWithoutImages,
    draftReceipts: receiptRepository.list().filter((r) => r.status === "draft").length,
    draftShipments: shipmentRepository.list().filter((s) => s.status === "draft").length,
  };
}
