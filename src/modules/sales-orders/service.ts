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
    salesOrderRepository.update(existingId, header);
    salesOrderRepository.replaceLines(existingId, lines);
    return { success: true, id: existingId };
  }
  const created = salesOrderRepository.create(header, lines);
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
  salesOrderRepository.update(soId, { status: "confirmed" });
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
  salesOrderRepository.update(soId, {
    status: "cancelled",
    cancelReasonCode: code,
    ...(comment !== undefined ? { cancelReasonComment: comment } : {}),
  });
  return { success: true };
}

function hasPostedShipmentForSo(soId: string): boolean {
  return shipmentRepository
    .list()
    .some((s) => s.salesOrderId === soId && s.status === "posted");
}

export function createShipment(soId: string): CreateShipmentResult {
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "confirmed")
    return {
      success: false,
      error: "Only confirmed sales orders can have a shipment created.",
    };
  if (hasPostedShipmentForSo(soId))
    return {
      success: false,
      error: "A posted shipment already exists for this sales order.",
    };

  const lines = salesOrderRepository.listLines(soId);
  const shipmentLines = lines.map((l) => ({ itemId: l.itemId, qty: l.qty }));
  const shipment = shipmentRepository.create(
    {
      date: so.date,
      salesOrderId: soId,
      warehouseId: so.warehouseId,
      status: "draft",
    },
    shipmentLines,
  );
  return { success: true, shipmentId: shipment.id };
}

export const salesOrderService = {
  confirm,
  cancelDocument,
  createShipment,
  saveDraft,
};
