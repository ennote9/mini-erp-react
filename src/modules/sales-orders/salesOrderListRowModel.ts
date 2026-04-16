import type { TFunction } from "@/shared/i18n";
import type { SalesOrder } from "./model";
import { salesOrderRepository } from "./repository";
import { customerRepository } from "@/modules/customers/repository";
import { carrierRepository } from "@/modules/carriers/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";

/** Sales order row enriched for list display, filters, export, and sorting. */
export type SalesOrderListRow = SalesOrder & {
  customerName: string;
  warehouseName: string;
  carrierLabel: string;
  carrierExport: string;
  carrierSearchBlob: string;
  recipientLabel: string;
  recipientPhoneLabel: string;
  recipientExport: string;
  recipientPhoneExport: string;
  recipientSearchBlob: string;
};

export function buildSalesOrderListRows(t: TFunction): SalesOrderListRow[] {
  const emDash = t("domain.audit.summary.emDash");
  const unknownCarrier = t("doc.shipment.unknownCarrier");
  return salesOrderRepository.list().map((so) => {
    const customer = customerRepository.getById(so.customerId);
    const warehouse = warehouseRepository.getById(so.warehouseId);
    const cid = so.carrierId?.trim() ?? "";
    let carrierLabel: string;
    let carrierExport: string;
    let carrierSearchBlob: string;
    if (cid === "") {
      carrierLabel = emDash;
      carrierExport = "";
      carrierSearchBlob = "";
    } else {
      const car = carrierRepository.getById(cid);
      if (!car) {
        carrierLabel = unknownCarrier;
        carrierExport = unknownCarrier;
        carrierSearchBlob = `${unknownCarrier} ${cid}`.toLowerCase();
      } else {
        carrierLabel = car.name;
        carrierExport = car.name;
        carrierSearchBlob = [car.name, car.code, cid].filter(Boolean).join(" ").toLowerCase();
      }
    }
    const recName = so.recipientName?.trim() ?? "";
    const recPhone = so.recipientPhone?.trim() ?? "";
    const recipientLabel = recName === "" ? emDash : recName;
    const recipientPhoneLabel = recPhone === "" ? emDash : recPhone;
    const recipientSearchBlob = [recName, recPhone].filter(Boolean).join(" ").toLowerCase();
    return {
      ...so,
      customerName: customer?.name ?? so.customerId,
      warehouseName: warehouse?.name ?? so.warehouseId,
      carrierLabel,
      carrierExport,
      carrierSearchBlob,
      recipientLabel,
      recipientPhoneLabel,
      recipientExport: recName,
      recipientPhoneExport: recPhone,
      recipientSearchBlob,
    };
  });
}
