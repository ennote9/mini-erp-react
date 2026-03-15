import { salesOrderRepository } from "./repository";
import { shipmentRepository } from "../shipments/repository";
import { customerRepository } from "../customers/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { normalizeDateForSO, validateDateForSO } from "./dateUtils";
import {
  validateDocumentLines,
  normalizeDocumentLines,
  normalizeDocumentComment,
} from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";

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
  comment?: string;
  lines: Array<{ itemId: string; qty: number }>;
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
  return null;
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
  const lines = normalizeDocumentLines(data.lines);

  const header = {
    date,
    customerId,
    warehouseId,
    status: "draft" as const,
    comment: comment ?? "",
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
  return null;
}

export function confirm(soId: string): ConfirmResult {
  const err = validateConfirm(soId);
  if (err) return { success: false, error: err };
  salesOrderRepository.update(soId, { status: "confirmed" });
  return { success: true };
}

export function cancelDocument(soId: string): CancelDocumentResult {
  const so = salesOrderRepository.getById(soId);
  if (!so) return { success: false, error: "Sales order not found." };
  if (so.status !== "draft" && so.status !== "confirmed")
    return {
      success: false,
      error: "Only draft or confirmed sales orders can be cancelled.",
    };
  salesOrderRepository.update(soId, { status: "cancelled" });
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
