import type { PurchaseOrder } from "./model";
import { purchaseOrderRepository } from "./repository";
import { supplierRepository } from "@/modules/suppliers/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";

/** Purchase order row enriched for list display, filters, export, and sorting. */
export type PurchaseOrderListRow = PurchaseOrder & {
  supplierName: string;
  warehouseName: string;
};

export function buildPurchaseOrderListRows(): PurchaseOrderListRow[] {
  return purchaseOrderRepository.list().map((po) => {
    const supplier = supplierRepository.getById(po.supplierId);
    const warehouse = warehouseRepository.getById(po.warehouseId);
    return {
      ...po,
      supplierName: supplier?.name ?? po.supplierId,
      warehouseName: warehouse?.name ?? po.warehouseId,
    };
  });
}
