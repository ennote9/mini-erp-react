import type { TFunction } from "./resolve";
import type {
  PlanningDocumentExcelLabels,
  ReceiptExcelLabels,
  ShipmentExcelLabels,
} from "../export/excelExportLabels";

export function planningPurchaseOrderExportLabels(t: TFunction): PlanningDocumentExcelLabels {
  return {
    linesSheetName: t("exportExcel.doc.sheetLines"),
    documentSheetName: t("exportExcel.doc.sheetDocument"),
    planningLineHeaders: [
      t("exportExcel.doc.lineNo"),
      t("exportExcel.doc.lineItemCode"),
      t("exportExcel.doc.lineItemName"),
      t("exportExcel.doc.lineBrand"),
      t("exportExcel.doc.lineCategory"),
      t("exportExcel.doc.lineQty"),
      t("exportExcel.doc.lineUnitPrice"),
      t("exportExcel.doc.lineLineAmount"),
    ] as PlanningDocumentExcelLabels["planningLineHeaders"],
    planningDocumentLabels: [
      t("exportExcel.doc.labelNumber"),
      t("exportExcel.doc.labelDate"),
      t("exportExcel.doc.labelStatus"),
      t("exportExcel.doc.labelSupplier"),
      t("exportExcel.doc.labelWarehouse"),
      t("exportExcel.doc.labelComment"),
      t("exportExcel.doc.labelTotalQty"),
      t("exportExcel.doc.labelTotalAmount"),
    ],
  };
}

export function planningSalesOrderExportLabels(t: TFunction): PlanningDocumentExcelLabels {
  const base = planningPurchaseOrderExportLabels(t);
  const L = base.planningDocumentLabels;
  return {
    ...base,
    planningDocumentLabels: [
      L[0]!,
      L[1]!,
      L[2]!,
      t("exportExcel.doc.labelCustomer"),
      L[4]!,
      t("exportExcel.doc.labelRecipientName"),
      t("exportExcel.doc.labelRecipientPhone"),
      t("exportExcel.doc.labelDeliveryAddress"),
      t("exportExcel.doc.labelDeliveryComment"),
      L[5]!,
      L[6]!,
      L[7]!,
    ],
  };
}

export function receiptExcelExportLabels(t: TFunction): ReceiptExcelLabels {
  return {
    linesSheetName: t("exportExcel.doc.sheetLines"),
    documentSheetName: t("exportExcel.doc.sheetDocument"),
    receiptLineHeaders: [
      t("exportExcel.doc.lineNo"),
      t("exportExcel.doc.lineItemCode"),
      t("exportExcel.doc.lineItemName"),
      t("exportExcel.doc.lineBrand"),
      t("exportExcel.doc.lineCategory"),
      t("exportExcel.doc.lineQty"),
      t("exportExcel.doc.lineUom"),
    ] as ReceiptExcelLabels["receiptLineHeaders"],
    receiptDocumentLabels: [
      t("exportExcel.doc.labelNumber"),
      t("exportExcel.doc.labelDate"),
      t("exportExcel.doc.labelRelatedPurchaseOrder"),
      t("exportExcel.doc.labelWarehouse"),
      t("exportExcel.doc.labelComment"),
    ] as ReceiptExcelLabels["receiptDocumentLabels"],
  };
}

export function shipmentExcelExportLabels(t: TFunction): ShipmentExcelLabels {
  return {
    linesSheetName: t("exportExcel.doc.sheetLines"),
    documentSheetName: t("exportExcel.doc.sheetDocument"),
    shipmentLineHeaders: [
      t("exportExcel.doc.lineNo"),
      t("exportExcel.doc.lineItemCode"),
      t("exportExcel.doc.lineItemName"),
      t("exportExcel.doc.lineBrand"),
      t("exportExcel.doc.lineCategory"),
      t("exportExcel.doc.lineQty"),
      t("exportExcel.doc.lineUom"),
    ] as ShipmentExcelLabels["shipmentLineHeaders"],
    shipmentDocumentLabels: [
      t("exportExcel.doc.labelNumber"),
      t("exportExcel.doc.labelDate"),
      t("exportExcel.doc.labelRelatedSalesOrder"),
      t("exportExcel.doc.labelWarehouse"),
      t("exportExcel.doc.labelCarrier"),
      t("exportExcel.doc.labelTrackingNumber"),
      t("exportExcel.doc.labelRecipientName"),
      t("exportExcel.doc.labelRecipientPhone"),
      t("exportExcel.doc.labelDeliveryAddress"),
      t("exportExcel.doc.labelDeliveryComment"),
      t("exportExcel.doc.labelComment"),
    ] as ShipmentExcelLabels["shipmentDocumentLabels"],
  };
}
