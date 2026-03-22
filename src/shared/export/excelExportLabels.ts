/**
 * User-visible labels passed into Excel export builders (sheet titles, column headers).
 * Callers build these from i18n `t("exportExcel.*")` at export time.
 */

export type ExcelListSheetLabels = {
  sheetName: string;
  /** Column headers left-to-right; length must match the export module. */
  headers: readonly string[];
};

export type PlanningDocumentExcelLabels = {
  linesSheetName: string;
  documentSheetName: string;
  /** PO/SO Lines grid — 8 columns */
  planningLineHeaders: readonly [string, string, string, string, string, string, string, string];
  /** Left column on Document sheet — Number … Total amount */
  planningDocumentLabels: readonly [string, string, string, string, string, string, string, string];
};

export type ReceiptExcelLabels = {
  linesSheetName: string;
  documentSheetName: string;
  /** Receipt Lines — 7 columns */
  receiptLineHeaders: readonly [string, string, string, string, string, string, string];
  /** Document sheet — 5 rows */
  receiptDocumentLabels: readonly [string, string, string, string, string];
};

export type ShipmentExcelLabels = {
  linesSheetName: string;
  documentSheetName: string;
  shipmentLineHeaders: readonly [string, string, string, string, string, string, string];
  shipmentDocumentLabels: readonly [string, string, string, string, string];
};
