import type { AppSettings } from "./types";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    theme: "dark",
    dateFormat: "iso",
    numberFormat: "commaDot",
    hotkeysEnabled: true,
  },
  documents: {
    blockConfirmWhenPlanningHasBlockingErrors: true,
    blockPostWhenFactualHasBlockingErrors: true,
    showDocumentEventLog: true,
    requireCancelReason: true,
    requireReversalReason: true,
    autoClosePlanningOnFullFulfillment: true,
    singleDraftReceiptPerPurchaseOrder: true,
    singleDraftShipmentPerSalesOrder: true,
  },
  inventory: {
    reservationsEnabled: true,
    requireReservationBeforeShipment: false,
    allocationMode: "manual",
    releaseReservationsOnSalesOrderCancel: true,
    releaseReservationsOnSalesOrderClose: true,
    reconcileReservationsOnSalesOrderSaveConfirm: true,
  },
  commercial: {
    moneyDecimalPlaces: 2,
    zeroPriceLinesRequireReason: true,
    partnerTermsOverwrite: "document_wins",
  },
  dataAudit: {
    auditLogEnabled: true,
    showAppVersion: true,
  },
};
