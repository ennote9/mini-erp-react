import type { ExcelListSheetLabels } from "../export/excelExportLabels";
import type { TFunction } from "./resolve";

export function brandsListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.brands"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function categoriesListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.categories"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function warehousesListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.warehouses"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function carriersListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.carriers"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colCarrierType"),
      t("exportExcel.list.colPhone"),
      t("exportExcel.list.colEmail"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function suppliersListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.suppliers"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colPhone"),
      t("exportExcel.list.colEmail"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function customersListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.customers"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colPhone"),
      t("exportExcel.list.colEmail"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function itemsListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.items"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colCode"),
      t("exportExcel.list.colName"),
      t("exportExcel.list.colBrand"),
      t("exportExcel.list.colCategory"),
      t("exportExcel.list.colUom"),
      t("exportExcel.list.colPurchasePrice"),
      t("exportExcel.list.colSalePrice"),
      t("exportExcel.list.colActive"),
    ],
  };
}

export function purchaseOrdersListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.purchaseOrders"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colDocNumber"),
      t("exportExcel.list.colDate"),
      t("exportExcel.list.colSupplier"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colStatus"),
    ],
  };
}

export function salesOrdersListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.salesOrders"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colDocNumber"),
      t("exportExcel.list.colDate"),
      t("exportExcel.list.colCustomer"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colStatus"),
    ],
  };
}

export function receiptsListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.receipts"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colDocNumber"),
      t("exportExcel.list.colDate"),
      t("exportExcel.list.colPurchaseOrder"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colStatus"),
    ],
  };
}

export function shipmentsListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.shipments"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colDocNumber"),
      t("exportExcel.list.colDate"),
      t("exportExcel.list.colSalesOrder"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colCarrier"),
      t("exportExcel.list.colTrackingNumber"),
      t("exportExcel.list.colStatus"),
    ],
  };
}

export function stockBalancesListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.stockBalances"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colItemCode"),
      t("exportExcel.list.colItemName"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colTotalQuantity"),
      t("exportExcel.list.colReserved"),
      t("exportExcel.list.colAvailable"),
      t("exportExcel.list.colDeficit"),
      t("exportExcel.list.colOutgoing"),
      t("exportExcel.list.colIncoming"),
      t("exportExcel.list.colNetShortage"),
      t("exportExcel.list.colCoverage"),
    ],
  };
}

export function stockMovementsListExcelLabels(t: TFunction): ExcelListSheetLabels {
  return {
    sheetName: t("exportExcel.list.stockMovements"),
    headers: [
      t("exportExcel.list.colNo"),
      t("exportExcel.list.colDateTime"),
      t("exportExcel.list.colMovementType"),
      t("exportExcel.list.colItemCode"),
      t("exportExcel.list.colItemName"),
      t("exportExcel.list.colWarehouse"),
      t("exportExcel.list.colQtyDelta"),
      t("exportExcel.list.colSourceDocument"),
    ],
  };
}
