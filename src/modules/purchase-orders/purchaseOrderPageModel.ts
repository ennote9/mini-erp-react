import type { PurchaseOrderLine } from "./model";
import { todayYYYYMMDD } from "./dateUtils";

export type LineWithItem = PurchaseOrderLine & { itemName: string };

export type LineFormRow = {
  itemId: string;
  qty: number;
  unitPrice: number;
  zeroPriceReasonCode: string;
  _lineId: number;
};

export type FormState = {
  date: string;
  supplierId: string;
  warehouseId: string;
  preliminaryDeliveryDate: string;
  actualArrivalDateTime: string;
  paymentTermsDays: string;
  comment: string;
  lines: LineFormRow[];
};

export function defaultPurchaseOrderForm(): FormState {
  return {
    date: todayYYYYMMDD(),
    supplierId: "",
    warehouseId: "",
    preliminaryDeliveryDate: "",
    actualArrivalDateTime: "",
    paymentTermsDays: "",
    comment: "",
    lines: [],
  };
}
