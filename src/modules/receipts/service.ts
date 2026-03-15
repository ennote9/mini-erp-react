import { receiptRepository } from "./repository";
import { purchaseOrderRepository } from "../purchase-orders/repository";
import { warehouseRepository } from "../warehouses/repository";
import { itemRepository } from "../items/repository";
import { stockMovementRepository } from "../stock-movements/repository";
import { stockBalanceRepository } from "../stock-balances/repository";
import { validateDocumentLines } from "../../shared/documentValidation";
import { normalizeTrim } from "../../shared/validation";

export type PostResult = { success: true } | { success: false; error: string };
export type CancelDocumentResult = { success: true } | { success: false; error: string };

function validatePost(receiptId: string): string | null {
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) return "Receipt not found.";
  if (receipt.status !== "draft") return "Only draft receipts can be posted.";

  const poIdTrimmed = normalizeTrim(receipt.purchaseOrderId);
  if (poIdTrimmed === "") return "Related purchase order is required.";
  const po = purchaseOrderRepository.getById(poIdTrimmed);
  if (!po) return "Related purchase order is required.";
  if (po.status !== "confirmed")
    return "Related purchase order must be confirmed before posting.";

  const warehouseIdTrimmed = normalizeTrim(receipt.warehouseId);
  if (warehouseIdTrimmed === "") return "Warehouse is required.";
  const warehouse = warehouseRepository.getById(warehouseIdTrimmed);
  if (!warehouse) return "Warehouse is required.";
  if (!warehouse.isActive) return "Selected warehouse is inactive.";

  const lines = receiptRepository.listLines(receiptId);
  const lineErr = validateDocumentLines(lines, itemRepository);
  if (lineErr) return lineErr;

  const postedForSamePo = receiptRepository
    .list()
    .some(
      (r) =>
        r.purchaseOrderId === receipt.purchaseOrderId &&
        r.id !== receiptId &&
        r.status === "posted",
    );
  if (postedForSamePo) return "A posted receipt already exists for this purchase order.";

  return null;
}

export function post(receiptId: string): PostResult {
  const err = validatePost(receiptId);
  if (err) return { success: false, error: err };

  const receipt = receiptRepository.getById(receiptId)!;
  const lines = receiptRepository.listLines(receiptId);
  const now = new Date().toISOString();

  for (const line of lines) {
    stockMovementRepository.create({
      datetime: now,
      movementType: "receipt",
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyDelta: line.qty,
      sourceDocumentType: "receipt",
      sourceDocumentId: receiptId,
    });

    const existing = stockBalanceRepository.getByItemAndWarehouse(
      line.itemId,
      receipt.warehouseId,
    );
    const newQty = (existing?.qtyOnHand ?? 0) + line.qty;
    stockBalanceRepository.upsert({
      itemId: line.itemId,
      warehouseId: receipt.warehouseId,
      qtyOnHand: newQty,
    });
  }

  receiptRepository.update(receiptId, { status: "posted" });
  purchaseOrderRepository.update(receipt.purchaseOrderId, { status: "closed" });
  return { success: true };
}

export function cancelDocument(receiptId: string): CancelDocumentResult {
  const receipt = receiptRepository.getById(receiptId);
  if (!receipt) return { success: false, error: "Receipt not found." };
  if (receipt.status !== "draft")
    return { success: false, error: "Only draft receipts can be cancelled." };
  receiptRepository.update(receiptId, { status: "cancelled" });
  return { success: true };
}

export const receiptService = {
  post,
  cancelDocument,
};
