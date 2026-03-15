import { purchaseOrderRepository } from "./repository";
import { receiptRepository } from "../receipts/repository";
import { supplierRepository } from "../suppliers/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { normalizeDateForPO, validateDateForPO } from "./dateUtils";
import {
  validateDocumentLines,
  normalizeDocumentLines,
  normalizeDocumentComment,
} from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";

export type ConfirmResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult = { success: true } | { success: false; error: string };
export type CreateReceiptResult =
  | { success: true; receiptId: string }
  | { success: false; error: string };

export type SaveDraftInput = {
  date: string;
  supplierId: string;
  warehouseId: string;
  comment?: string;
  lines: Array<{ itemId: string; qty: number }>;
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
  return null;
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
  const lines = normalizeDocumentLines(data.lines);

  const header = {
    date,
    supplierId,
    warehouseId,
    status: "draft" as const,
    comment: comment ?? "",
  };
  if (existingId) {
    const po = purchaseOrderRepository.getById(existingId);
    if (!po) return { success: false, error: "Purchase order not found." };
    if (po.status !== "draft")
      return { success: false, error: "Only draft purchase orders can be saved." };
    purchaseOrderRepository.update(existingId, header);
    purchaseOrderRepository.replaceLines(existingId, lines);
    return { success: true, id: existingId };
  }
  const created = purchaseOrderRepository.create(header, lines);
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
  return null;
}

export function confirm(poId: string): ConfirmResult {
  const err = validateConfirm(poId);
  if (err) return { success: false, error: err };
  purchaseOrderRepository.update(poId, { status: "confirmed" });
  return { success: true };
}

export function cancelDocument(poId: string): CancelDocumentResult {
  const po = purchaseOrderRepository.getById(poId);
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "draft" && po.status !== "confirmed")
    return { success: false, error: "Only draft or confirmed purchase orders can be cancelled." };
  purchaseOrderRepository.update(poId, { status: "cancelled" });
  return { success: true };
}

function hasPostedReceiptForPo(poId: string): boolean {
  return receiptRepository
    .list()
    .some((r) => r.purchaseOrderId === poId && r.status === "posted");
}

export function createReceipt(poId: string): CreateReceiptResult {
  const po = purchaseOrderRepository.getById(poId);
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "confirmed")
    return { success: false, error: "Only confirmed purchase orders can have a receipt created." };
  if (hasPostedReceiptForPo(poId))
    return { success: false, error: "A posted receipt already exists for this purchase order." };

  const lines = purchaseOrderRepository.listLines(poId);
  const receiptLines = lines.map((l) => ({ itemId: l.itemId, qty: l.qty }));
  const receipt = receiptRepository.create(
    {
      date: po.date,
      purchaseOrderId: poId,
      warehouseId: po.warehouseId,
      status: "draft",
    },
    receiptLines,
  );
  return { success: true, receiptId: receipt.id };
}

export const purchaseOrderService = {
  confirm,
  cancelDocument,
  createReceipt,
  saveDraft,
};
