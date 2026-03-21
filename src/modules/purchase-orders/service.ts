import { purchaseOrderRepository } from "./repository";
import { receiptRepository } from "../receipts/repository";
import { supplierRepository } from "../suppliers/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { normalizeDateForPO, validateDateForPO } from "./dateUtils";
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
  resolveCancelDocumentReasonForService,
  zeroPriceReasonCodeForStore,
  type CancelDocumentReasonInput,
} from "../../shared/reasonCodes";
import { getAppSettings } from "../../shared/settings/store";
import { appendAuditEvent } from "../../shared/audit/eventLogRepository";
import { AUDIT_ACTOR_LOCAL_USER } from "../../shared/audit/eventLogTypes";
import { auditReceiptDocumentCreated } from "../../shared/audit/factualDocumentAudit";
import {
  appendPlanningLineChangeAudit,
  planningHeaderChangedFields,
} from "../../shared/audit/planningLineAudit";
import {
  computePurchaseOrderFulfillment,
  isPurchaseOrderReceiptFulfillmentComplete,
} from "../../shared/planningFulfillment";
import type { PurchaseOrder } from "./model";

export type ConfirmResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult = { success: true } | { success: false; error: string };

export type CreateReceiptResult =
  | { success: true; receiptId: string }
  | { success: false; error: string };

export type SaveDraftInput = {
  date: string;
  supplierId: string;
  warehouseId: string;
  /** Raw form text; empty = no terms stored. */
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
  const dateErr = validateDateForPO(data.date);
  if (dateErr) return dateErr;
  const supplierIdTrimmed = normalizeTrim(data.supplierId);
  if (supplierIdTrimmed === "") return "Supplier is required.";
  const warehouseIdTrimmed = normalizeTrim(data.warehouseId);
  if (warehouseIdTrimmed === "") return "Warehouse is required.";
  const supplier = supplierRepository.getById(supplierIdTrimmed);
  if (!supplier) return "Supplier is required.";
  if (!supplier.isActive) return "Selected supplier is inactive.";
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

function normalizePOLines(
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

function poHeaderFlat(po: PurchaseOrder) {
  return {
    date: po.date,
    supplierId: po.supplierId,
    warehouseId: po.warehouseId,
    comment: po.comment ?? "",
    paymentTermsDays: po.paymentTermsDays ?? null,
    dueDate: po.dueDate ?? null,
  };
}

export function saveDraft(
  data: SaveDraftInput,
  existingId?: string,
): SaveDraftResult {
  const err = validateSaveDraft(data);
  if (err) return { success: false, error: err };

  const date = normalizeDateForPO(data.date);
  const supplierId = normalizeTrim(data.supplierId);
  const warehouseId = normalizeTrim(data.warehouseId);
  const comment = normalizeDocumentComment(data.comment);
  const paymentTermsDays = parsePaymentTermsDaysToStore(data.paymentTermsDays);
  const dueDate = computePlanningDueDate(date, paymentTermsDays);
  const lines = normalizePOLines(data.lines);
  if (lines === null)
    return { success: false, error: "Each line must have a valid unit price (number ≥ 0)." };

  const header = {
    date,
    supplierId,
    warehouseId,
    status: "draft" as const,
    comment: comment ?? "",
    paymentTermsDays,
    dueDate,
  };
  if (existingId) {
    const po = purchaseOrderRepository.getById(existingId);
    if (!po) return { success: false, error: "Purchase order not found." };
    if (po.status !== "draft")
      return { success: false, error: "Only draft purchase orders can be saved." };
    const oldLines = purchaseOrderRepository.listLines(existingId);
    const beforeHeader = poHeaderFlat(po);
    purchaseOrderRepository.update(existingId, header);
    purchaseOrderRepository.replaceLines(existingId, lines);
    const poAfter = purchaseOrderRepository.getById(existingId)!;
    const newLines = purchaseOrderRepository.listLines(existingId);
    const afterHeader = poHeaderFlat(poAfter);
    const changedFields = planningHeaderChangedFields(
      beforeHeader as unknown as Record<string, unknown>,
      afterHeader as unknown as Record<string, unknown>,
      ["date", "supplierId", "warehouseId", "comment", "paymentTermsDays", "dueDate"],
    );
    if (changedFields.length > 0) {
      appendAuditEvent({
        entityType: "purchase_order",
        entityId: existingId,
        eventType: "document_saved",
        actor: AUDIT_ACTOR_LOCAL_USER,
        payload: {
          documentNumber: poAfter.number,
          changedFields,
        },
      });
    }
    appendPlanningLineChangeAudit({
      entityType: "purchase_order",
      entityId: existingId,
      documentNumber: poAfter.number,
      oldLines,
      newLinesFromDb: newLines,
      itemCode: itemCodeForAudit,
    });
    return { success: true, id: existingId };
  }
  const created = purchaseOrderRepository.create(header, lines);
  const doc = purchaseOrderRepository.getById(created.id)!;
  const createdLines = purchaseOrderRepository.listLines(created.id);
  appendAuditEvent({
    entityType: "purchase_order",
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

function validateConfirm(poId: string): string | null {
  const po = purchaseOrderRepository.getById(poId);
  if (!po) return "Purchase order not found.";
  if (po.status !== "draft") return "Only draft purchase orders can be confirmed.";

  if (!po.date?.trim()) return "Date is required.";
  if (!po.supplierId?.trim()) return "Supplier is required.";
  if (!po.warehouseId?.trim()) return "Warehouse is required.";

  const supplier = supplierRepository.getById(po.supplierId);
  if (!supplier?.isActive) return "Selected supplier is inactive.";
  const warehouse = warehouseRepository.getById(po.warehouseId);
  if (!warehouse?.isActive) return "Selected warehouse is inactive.";

  const lines = purchaseOrderRepository.listLines(poId);
  const lineErr = validateDocumentLines(lines, itemRepository);
  if (lineErr) return lineErr;
  const priceErr = validatePlanningLineUnitPrices(lines);
  if (priceErr) return priceErr;
  const zpErr = validatePlanningLinesZeroPriceReasons(lines);
  if (zpErr) return zpErr;
  return null;
}

export function confirm(poId: string): ConfirmResult {
  const err = validateConfirm(poId);
  if (err) return { success: false, error: err };
  const po = purchaseOrderRepository.getById(poId)!;
  purchaseOrderRepository.update(poId, { status: "confirmed" });
  appendAuditEvent({
    entityType: "purchase_order",
    entityId: poId,
    eventType: "document_confirmed",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: po.number,
      previousStatus: po.status,
      newStatus: "confirmed" as const,
    },
  });
  return { success: true };
}

export function cancelDocument(
  poId: string,
  input: CancelDocumentReasonInput,
): CancelDocumentResult {
  const resolved = resolveCancelDocumentReasonForService(
    input,
    getAppSettings().documents.requireCancelReason,
  );
  if (!resolved.ok) return { success: false, error: resolved.error };
  const po = purchaseOrderRepository.getById(poId);
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "draft" && po.status !== "confirmed")
    return { success: false, error: "Only draft or confirmed purchase orders can be cancelled." };
  const cancelCode = resolved.code;
  const comment = resolved.comment;
  const prevStatus = po.status;
  purchaseOrderRepository.update(poId, {
    status: "cancelled",
    cancelReasonCode: cancelCode,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  appendAuditEvent({
    entityType: "purchase_order",
    entityId: poId,
    eventType: "document_cancelled",
    actor: AUDIT_ACTOR_LOCAL_USER,
    payload: {
      documentNumber: po.number,
      previousStatus: prevStatus,
      newStatus: "cancelled" as const,
      cancelReasonCode: cancelCode,
      cancelReasonComment: comment ?? null,
    },
  });
  return { success: true };
}

function hasDraftReceiptForPo(poId: string): boolean {
  return receiptRepository
    .list()
    .some((r) => r.purchaseOrderId === poId && r.status === "draft");
}

export function createReceipt(poId: string): CreateReceiptResult {
  const po = purchaseOrderRepository.getById(poId);
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "confirmed")
    return { success: false, error: "Only confirmed purchase orders can have a receipt created." };
  if (isPurchaseOrderReceiptFulfillmentComplete(poId)) {
    return {
      success: false,
      error: "Purchase order is already fully received (posted receipts).",
    };
  }
  if (
    getAppSettings().documents.singleDraftReceiptPerPurchaseOrder &&
    hasDraftReceiptForPo(poId)
  ) {
    return {
      success: false,
      error: "A draft receipt already exists for this purchase order.",
    };
  }

  const fulfillment = computePurchaseOrderFulfillment(poId);
  const receiptLines = fulfillment.lines
    .filter((row) => row.remainingQty > 0)
    .map((row) => ({ itemId: row.itemId, qty: row.remainingQty }));
  if (receiptLines.length === 0) {
    return {
      success: false,
      error: "Nothing remaining to receive for this purchase order.",
    };
  }
  const receipt = receiptRepository.create(
    {
      date: po.date,
      purchaseOrderId: poId,
      warehouseId: po.warehouseId,
      status: "draft",
    },
    receiptLines,
  );
  auditReceiptDocumentCreated(receipt);
  return { success: true, receiptId: receipt.id };
}

export const purchaseOrderService = {
  confirm,
  cancelDocument,
  createReceipt,
  saveDraft,
};
