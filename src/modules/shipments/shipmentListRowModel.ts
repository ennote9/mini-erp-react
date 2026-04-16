import type { TFunction } from "@/shared/i18n";
import type { Shipment } from "./model";
import { shipmentRepository } from "./repository";
import { salesOrderRepository } from "@/modules/sales-orders/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";
import { buildShipmentListRowExtras, type ShipmentListRowExtras } from "./shipmentListRowExtras";

/** Shipment row enriched for list display, filters, export, and sorting. */
export type ShipmentListRow = Shipment & {
  salesOrderNumber: string;
  warehouseName: string;
} & ShipmentListRowExtras;

export function buildShipmentListRows(t: TFunction): ShipmentListRow[] {
  const emDash = t("domain.audit.summary.emDash");
  const unknownCarrier = t("doc.shipment.unknownCarrier");
  return shipmentRepository.list().map((s) => {
    const so = salesOrderRepository.getById(s.salesOrderId);
    const warehouse = warehouseRepository.getById(s.warehouseId);
    const x = buildShipmentListRowExtras(s, { emDash, unknownCarrier });
    return {
      ...s,
      salesOrderNumber: so?.number ?? s.salesOrderId,
      warehouseName: warehouse?.name ?? s.warehouseId,
      ...x,
    };
  });
}
