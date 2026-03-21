import type { AppSettings } from "./types";

/**
 * Default install: Advanced workspace with every profile-visibility override explicitly ON
 * (not null), so behavior stays maximum even if mode defaults change later.
 */
const DEFAULT_PROFILE_OVERRIDES_MAX: AppSettings["general"]["profileOverrides"] = {
  documentEventLog: true,
  reverseDocumentActions: true,
  stockMovementsNav: true,
  advancedStockBalanceAnalytics: true,
  stockBalanceSourceModal: true,
  allocationControls: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    workspaceMode: "advanced",
    profileOverrides: { ...DEFAULT_PROFILE_OVERRIDES_MAX },
    locale: "en",
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
    requireReservationBeforeShipment: true,
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
