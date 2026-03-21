/**
 * Typed application settings model. Keys are grouped by stable section IDs for UI and growth.
 */

export type SettingsSectionId =
  | "general"
  | "documents"
  | "inventory"
  | "commercial"
  | "dataAudit";

/** Dark-first app; system follows OS preference. */
export type ThemePreference = "dark" | "system";

export type DateFormatId = "iso" | "eu" | "us";

/** Stored for future display formatting; not applied app-wide in v1. */
export type NumberFormatId = "spaceComma" | "commaDot" | "dotComma";

export type AllocationModeId = "manual";

/** Commercial partner payment terms vs document terms (preference only until enforced). */
export type PartnerTermsOverwriteId = "document_wins" | "master_wins";

export type AppSettings = {
  general: {
    theme: ThemePreference;
    dateFormat: DateFormatId;
    numberFormat: NumberFormatId;
    hotkeysEnabled: boolean;
  };
  documents: {
    /**
     * When true, Confirm is disabled on draft PO/SO while the planning health panel reports blocking errors.
     * Confirm in the service still runs its own checks (may differ slightly from on-screen health).
     */
    blockConfirmWhenPlanningHasBlockingErrors: boolean;
    /**
     * When true, Post is disabled on draft Receipt/Shipment while full validation reports blocking errors
     * (same rules as the post action).
     */
    blockPostWhenFactualHasBlockingErrors: boolean;
    /** Show the document event log section on purchase order, sales order, receipt, and shipment pages. */
    showDocumentEventLog: boolean;
    /** When true, cancel dialogs and services require a reason code. */
    requireCancelReason: boolean;
    /** When true, receipt/shipment reversal requires a reason code. */
    requireReversalReason: boolean;
    /**
     * When true, posting the final receipt/shipment sets the planning document to Closed if fully fulfilled.
     * Matches current posting behavior (not user-toggleable off without new product rules).
     */
    autoClosePlanningOnFullFulfillment: boolean;
    /** Block creating a second draft receipt for the same confirmed PO. */
    singleDraftReceiptPerPurchaseOrder: boolean;
    /** Block creating a second draft shipment for the same confirmed SO. */
    singleDraftShipmentPerSalesOrder: boolean;
  };
  inventory: {
    /** Stock reservations exist in the model; disabling the feature is not supported. */
    reservationsEnabled: boolean;
    requireReservationBeforeShipment: boolean;
    allocationMode: AllocationModeId;
    /** Release active reservations when a sales order is cancelled. */
    releaseReservationsOnSalesOrderCancel: boolean;
    /**
     * After posting a shipment that fully fulfills the SO, run reservation cleanup for Closed.
     * When off, explicit reconcile on close is skipped (reservations may linger until another action).
     */
    releaseReservationsOnSalesOrderClose: boolean;
    /** Run reservation reconcile after SO draft save and on confirm. */
    reconcileReservationsOnSalesOrderSaveConfirm: boolean;
  };
  commercial: {
    /** Decimal places for money rounding on PO/SO (clamped 2–4 at runtime). */
    moneyDecimalPlaces: number;
    zeroPriceLinesRequireReason: boolean;
    partnerTermsOverwrite: PartnerTermsOverwriteId;
  };
  dataAudit: {
    auditLogEnabled: boolean;
    showAppVersion: boolean;
  };
};

export type SettingReadiness =
  | "active"
  /** Wired with known limitations (described in row text). */
  | "partial"
  /** Value is saved; not yet read by business logic (labeled in UI). */
  | "storedOnly"
  /** Shown as fixed / read-only explanation. */
  | "informational";

export type SettingValueType = "boolean" | "enum" | "number" | "text" | "readonly";

export type SettingRegistryEntry = {
  /** Stable id, e.g. general.theme */
  id: string;
  section: SettingsSectionId;
  valueType: SettingValueType;
  label: string;
  description: string;
  readiness: SettingReadiness;
  /** For enum/select rows */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Clamp for number inputs */
  numberMin?: number;
  numberMax?: number;
};
