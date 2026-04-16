import type { Receipt } from "./model";
import { receiptRepository } from "./repository";
import { purchaseOrderRepository } from "@/modules/purchase-orders/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";

/** Receipt row enriched for list display, filters, export, and sorting. */
export type ReceiptListRow = Receipt & {
  purchaseOrderNumber: string;
  warehouseName: string;
};

export function buildReceiptListRows(): ReceiptListRow[] {
  return receiptRepository.list().map((r) => {
    const po = purchaseOrderRepository.getById(r.purchaseOrderId);
    const warehouse = warehouseRepository.getById(r.warehouseId);
    return {
      ...r,
      purchaseOrderNumber: po?.number ?? r.purchaseOrderId,
      warehouseName: warehouse?.name ?? r.warehouseId,
    };
  });
}
