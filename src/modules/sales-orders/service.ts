import { salesOrderRepository } from "./repository";
import { shipmentRepository } from "../shipments/repository";
import { customerRepository } from "../customers/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { normalizeDateForSO, validateDateForSO } from "./dateUtils";
import {
  validateDocumentLines,
  parseDocumentLineQty,
  normalizeDocumentComment,
  validatePlanningLineUnitPrices,
  validatePlanningLinesZeroPriceReasons,
} from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";
import { parseCommercialUnitPrice } from "../../shared/commercialMoney";
import {
  computePlanningDueDate,
  parsePaymentTermsDaysToStore,
  validatePaymentTermsDaysForm,
} from "../../shared/planningCommercialDates";
import {
  normalizeCancelReasonComment,
  validateCancelDocumentReasonForm,
  zeroPriceReasonCodeForStore,
  type CancelDocumentReasonCode,
  type CancelDocumentReasonInput,
} from "../../shared/reasonCodes";
import { appendAuditEvent } from "../../shared/audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "../../shared/audit/eventLogTypes";
import { auditShipmentDocumentCreated } from "../../shared/audit/factualDocumentAudit";
import {
  appendPlanningLineChangeAudit,
  planningHeaderChangedFields,
} from "../../shared/audit/planningLineAudit";
import {
  computeSalesOrderFulfillment,
  isSalesOrderShipmentFulfillmentComplete,
} from "../../shared/planningFulfillment";
import type { SalesOrder } from "./model";

export type ConfirmResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult =
  | { success: true }
  | { success: false; error: string };

export type CreateShipmentResult =
  | { success: true; shipmentId: string }
  | { success: false; error: string };

export type SaveDraftInput = {
  date: string;
  customerId: string;
  warehouseId: string;
  paymentTermsDays?: string;
  comment?: string;
  lines: Array<{
    itemId: string;
    qty: number;
    unitPrice?: number;
    zeroPriceReasonCode?: string;
  }>;
};
export type SaveDraftResult =
  | { success: true; id: string }
  | { success: false; error: string };

function validateSaveDraft(data: SaveDraftInput): string | null {
  const dateErr = validateDateForSO(data.date);
  if (dateErr) return dateErr;
  const customerIdTrimmed = normalizeTrim(data.customerId);
  if (customerIdTrimmed === "") return "Customer is required.";
  const warehouseIdTrimmed = normalizeTrim(data.warehouseId);
  if (warehouseIdTrimmed === "") return "Warehouse is required.";
  const customer = customerRepository.getById(customerIdTrimmed);
  if (!customer) return "Customer is required.";
  if (!customer.isActive) return "Selected customer is inactive.";
  const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
  if (!warehouse) return "Warehouse is required.";
  if (!warehouse.isActive) return "Selected warehouse is inactive.";
  const lineErr = validateDocumentLines(data.lines, itemRepository);
  if (lineErr) return lineErr;
  const priceErr = validatePlanningLineUnitPrices(data.lines);
  if (priceErr) return priceErr;
  const zpErr = validatePlanningLinesZeroPriceReasons(data.lines);
  if (zpErr) return zpErr;
  const termsErr = validatePaymentTermsDaysForm(data.paymentTermsDays);
  if (termsErr) return termsErr;
  return null;
}

function normalizeSOLines(
  lines: Array<{
    itemId: string;
    qty: number;
    unitPrice?: number;
    zeroPriceReasonCode?: string;
  }>,
): Array<{
  itemId: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode?: string;
}> | null {
  const out: Array<{
    itemId: string;
    qty: number;
    unitPrice: number;
    zeroPriceReasonCode?: string;
  }> = [];
  for (const l of lines) {
    const qty = parseDocumentLineQty(l.qty);
    if (qty === null) return null;
    const unitPrice = parseCommercialUnitPrice(l.unitPrice);
    if (unitPrice === null) return null;
    const zpr = zeroPriceReasonCodeForStore(unitPrice, l.zeroPriceReasonCode);
    const row: { itemId: string; qty: number; unitPrice: number; zeroPriceReasonCode?: string } = {
      itemId: normalizeTrim(l.itemId),
      qty,
      unitPrice,
    };
    if (zpr !== undefined) row.zeroPriceReasonCode = zpr;
    out.push(row);
  }
  return out;
}

function itemCodeForAudit(itemId: string): string {
  return itemRepository.getById(itemId)?.code ?? itemId;
}

function soHeaderFlat(so: SalesOrder) {
  return {
    date: so.date,
    customerId: so.customerId,
    warehouseId: so.warehouseId,
    comment: so.comment ?? "",
    paymentTermsDays: so.paymentTermsDays ?? null,
    dueDate: so.dueDate ?? null,
  };
}

export function saveDraft(
  data: SaveDraftInput,
  existingId?: string,
): SaveDraftResult {
  const err = validateSaveDraft(data);
  if (err) return { success: false, error: err };

  const date = normalizeDateForSO(data.date);
  const customerId = normalizeTrim(data.customerId);
  const warehouseId = normalizeTrim(data.warehouseId);
  const comment = normalizeDocumentComment(data.comment);
  const paymentTermsDays = parsePaymentTermsDaysToStore(data.paymentTermsDays);
  const dueDate = computePlanningDueDate(date, paymentTermsDays);
  const lines = normalizeSOLines(data.lines);
  if (lines === null)
    return { success: false, error: "Each line must have a valid unit price (number ≥ 0)." };

  const header = {
    date,
    customerId,
    warehouseId,
    status: "draft" as const,
    comment: comment ?? "",
    paymentTermsDays,
    dueDate,
  };
  if (existingId) {
    const so = salesOrderRepository.getById(existingId);
    if (!so) return { success: false, error: "Sales order not found." };
    if (so.status !== "draft")
      return { success: false, error: "Only draft sales orders can be saved." };
    const oldLines = salesOrderRepository.listLines(existingId);
    const beforeHeader = soHeaderFlat(so);
    salesOrderRepository.update(existingId, header);
    salesOrderRepository.replaceLines(existingId, lines);
    const soAfter = salesOrderRepository.getById(existingId)!;
    const newLines = salesOrderRepository.listLines(existingId);
    const afterHeader = soHeaderFlat(soAfter);
    const changedFields = planningHeaderChangedFields(
      beforeHeader as unknown as Record<string, unknown>,
      afterHeader as unknown as Record<string, unknown>,
      ["date", "customerId", "warehouseId", "comment", "paymentTermsDays", "dueDate"],
    );
    if (changedFields.length > 0) {
      appendAuditEvent({
        entityType: "sales_order",
        entityId: existingId,
        eventType: "document_saved",
        actor: AUDIT_ACTOR_LOCAL_USER,
        payload: {
          documentNumber: soAfter.number,
          changedFields,
        },
      });
    }
    appendPlanningLineChangeAudit({
      entityType: "sales_order",
      entityId: existingId,
      documentNumber: soAfter.number,
      oldLines,
      newLinesFromDb: newLines,
      itemCode: itemCodeForAudit,
    });
    return { success: true, id: existingId };
  }
  const created = salesOrderRepository.create(header, lines);
  const doc = salesOrderRepository.getById(created.id)!;
  const createdLines = salesOrderRepository.listLines(created.id);
  appendAuditEvent({
    entityType: "sales_order",
    entityId: created.id,
    eventType: "document_created",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: doc.number,
      status: doc.status,
      lineCount: createdLines.length,
      lines: createdLines.map((l) => ({
        lineId: l.id,
        itemId: l.itemId,
        itemCode: itemCodeForAudit(l.itemId),
        qty: l.qty,
        unitPrice: l.unitPrice,
        ...(l.zeroPriceReasonCode ? { zeroPriceReasonCode: l.zeroPriceReasonCode } : {}),
      })),
    },
  });
  return { success: true, id: created.id };
}

function validateConfirm(soId: string): string | null {
  const so = salesOrderRepository.getById(soId);
  if (!so) return "Sales order not found.";
  if (so.status !== "draft")
    return "Only draft sales orders can be confirmed.";

  if (!so.date?.trim()) return "Date is required.";
  if (!so.customerId?.trim()) return "Customer is required.";
  if (!so.warehouseId?.trim()) return "Warehouse is required.";

  const customer = customerRepository.getById(so.customerId);
  if (!customer?.isActive) return "Selected customer is inactive.";
  const warehouse = warehouseRepository.getById(so.warehouseId);
  if (!warehouse?.isActive) return "Selected warehouse is inactive.";

  const lines = salesOrderRepository.listLines(soId);
  const lineErr = validateDocumentLines(lines, itemRepository);
  if (lineErr) return lineErr;
  const priceErr = validatePlanningLineUnitPrices(lines);
  if (priceErr) return priceErr;
  const zpErr = validatePlanningLinesZeroPriceReasons(lines);
  if (zpErr) return zpErr;
  return null;
}

export function confirm(soId: string): ConfirmResult {
  const err = validateConfirm(soId);
  if (err) return { success: false, error: err };
  const so = salesOrderRepository.getById(soId)!;
  salesOrderRepository.update(soId, { status: "confirmed" });
  appendAuditEvent({
    entityType: "sales_order",
    entityId: soId,
    eventType: "document_confirmed",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: so.number,
      previousStatus: so.status,
      newStatus: "confirmed" as const,
    },
  });
  return { success: true };
}

export function cancelDocument(
  soId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const reasonErr = validateCancelDocumentReasonForm(input.cancelReasonCode);
  if (reasonErr) return { success: false, error: reasonErr };
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "draft" && so.status !== "confirmed")
    return {
      success: false,
      error: "Only draft or confirmed sales orders can be cancelled.",
    };
  const code = input.cancelReasonCode as CancelDocumentReasonCode;
  const comment = normalizeCancelReasonComment(input.cancelReasonComment);
  const prevStatus = so.status;
  salesOrderRepository.update(soId, {
    status: "cancelled",
    cancelReasonCode: code,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  appendAuditEvent({
    entityType: "sales_order",
    entityId: soId,
    eventType: "document_cancelled",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: so.number,
      previousStatus: prevStatus,
      newStatus: "cancelled" as const,
      cancelReasonCode: code,
      cancelReasonComment: comment ?? null,
    },
  });
  return { success: true };
}

function hasDraftShipmentForSo(soId: string): boolean {
  return shipmentRepository
    .list()
    .some((s) => s.salesOrderId === soId && s.status === "draft");
}

export function createShipment(soId: string): CreateShipmentResult {
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "confirmed")
    return {
      success: false,
      error: "Only confirmed sales orders can have a shipment created.",
    };
  if (isSalesOrderShipmentFulfillmentComplete(soId)) {
    return {
      success: false,
      error: "Sales order is already fully shipped (posted shipments).",
    };
  }
  if (hasDraftShipmentForSo(soId)) {
    return {
      success: false,
      error: "A draft shipment already exists for this sales order.",
    };
  }

  const fulfillment = computeSalesOrderFulfillment(soId);
  const shipmentLines = fulfillment.lines
    .filter((row) => row.remainingQty > 0)
    .map((row) => ({ itemId: row.itemId, qty: row.remainingQty }));
  if (shipmentLines.length === 0) {
    return {
      success: false,
      error: "Nothing remaining to ship for this sales order.",
    };
  }
  const shipment = shipmentRepository.create(
    {
      date: so.date,
      salesOrderId: soId,
      warehouseId: so.warehouseId,
      status: "draft",
    },
    shipmentLines,
  );
  auditShipmentDocumentCreated(shipment);
  return { success: true, shipmentId: shipment.id };
}

export const salesOrderService = {
  confirm,
  cancelDocument,
  createShipment,
  saveDraft,
};
