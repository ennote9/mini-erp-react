/**
 * Read-only aggregations for the operational dashboard from local repositories.
 */
import { purchaseOrderRepository } from "../purchase-orders/repository";
import { salesOrderRepository } from "../sales-orders/repository";
import { receiptRepository } from "../receipts/repository";
import { shipmentRepository } from "../shipments/repository";
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
