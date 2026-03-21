/** Settings page copy + registry rows (keys use __ instead of .) */
export const settingsEn = {
  page: {
    title: "Settings",
    subtitle:
      "Workspace preferences and system rules. Changes apply immediately when persistence is available.",
    loading: "Loading saved settings…",
    resetSection: "Reset this section to defaults",
    persistenceWhere:
      "Where these preferences are stored on this device (same as the status note at the top of this page).",
    persistenceLabel: "Settings persistence",
    buildInfoLabel: "Application",
    buildInfoDesc: "Build mode for this front-end bundle.",
  },
  persistence: {
    filePersisted: "Saved locally (app data folder).",
    fallbackTitle: "Using browser storage",
    fallbackBody:
      "App data file isn’t available; settings are stored in browser storage and still apply for this app.",
    notSavedTitle: "Settings are not being saved",
    notSavedBody:
      "Changes may be lost when you close the app. Check storage access or permissions.",
    corrupt: "The previous settings file was invalid and was replaced with defaults.",
    technicalDetails: "Technical details",
    summaryFile: "App data file",
    summaryBrowser: "Browser storage (fallback)",
    summaryNone: "Not saved (this session only)",
  },
  readinessTitle: {
    partial: "Works for some paths; see description for limits.",
    storedOnly: "Value is stored but not read by business logic yet.",
    informational: "Explains current system behavior; not a live toggle.",
  },
  sections: {
    workspaceProfile: {
      title: "Workspace profile",
      description: "Product complexity (Lite / Standard / Advanced) and visibility overrides.",
    },
    general: {
      title: "General",
      description: "Appearance, formats, and keyboard shortcuts.",
    },
    documents: {
      title: "Documents",
      description: "Planning and factual document behavior.",
    },
    inventory: {
      title: "Inventory",
      description: "Stock allocation and reservations.",
    },
    commercial: {
      title: "Commercial",
      description: "Pricing, rounding, and commercial rules on documents.",
    },
    dataAudit: {
      title: "Data & audit",
      description: "Diagnostics, audit trail, and data tools.",
    },
  },
  entries: {
    general__locale: {
      label: "Language",
      description: "User interface language. Applies immediately across the app.",
    },
    general__theme: {
      label: "Theme",
      description: "Dark keeps the standard ERP look. System follows your OS light/dark mode.",
    },
    general__dateFormat: {
      label: "Date format",
      description: "Stored for future use. Dates on screens are not yet fully driven by this setting.",
    },
    general__numberFormat: {
      label: "Number format",
      description: "Stored for future use. Grid and entry formatting still use the app default.",
    },
    general__hotkeysEnabled: {
      label: "Keyboard shortcuts",
      description: "List search (/) and document shortcuts (save, add line, import, allocate).",
    },
    documents__blockConfirmWhenPlanningHasBlockingErrors: {
      label: "Block Confirm when planning has errors",
      description:
        "Purchase order and sales order: disable Confirm while the document health strip shows blocking errors. Turning off allows Confirm from the header; the server still validates before confirming.",
    },
    documents__blockPostWhenFactualHasBlockingErrors: {
      label: "Block Post when receipt/shipment has errors",
      description:
        "Receipt and shipment: disable Post while full validation reports blocking errors (same checks as posting). Turning off allows attempting Post from the header; the server still rejects invalid posts.",
    },
    documents__showDocumentEventLog: {
      label: "Show event log on document pages",
      description:
        "Shows the audit event list on purchase order, sales order, receipt, and shipment pages. Events are always stored; this only affects visibility.",
    },
    documents__requireCancelReason: {
      label: "Require cancel reason",
      description:
        "When on, cancelling a draft planning or factual document requires selecting a reason. When off, cancellation still records reason code “Other” if none is chosen.",
    },
    documents__requireReversalReason: {
      label: "Require reversal reason",
      description:
        "When on, reversing a posted receipt or shipment requires a reason. When off, “Other” is stored if none is chosen.",
    },
    documents__autoClosePlanningOnFullFulfillment: {
      label: "Close planning when fully fulfilled",
      description:
        "When on, posting the receipt or shipment that completes all open lines sets the purchase order or sales order to Closed. When off, it stays Confirmed even after full fulfillment.",
    },
    documents__singleDraftReceiptPerPurchaseOrder: {
      label: "Allow only one draft receipt per purchase order",
      description:
        "When on, you cannot create a second draft receipt for the same confirmed PO until the first is posted or cancelled.",
    },
    documents__singleDraftShipmentPerSalesOrder: {
      label: "Allow only one draft shipment per sales order",
      description:
        "When on, you cannot create a second draft shipment for the same confirmed SO until the first is posted or cancelled.",
    },
    documents__reversalOnlyFromPosted: {
      label: "Reversal only from posted status",
      description:
        "Posted receipts and shipments may be fully reversed once (reason recorded); draft or cancelled documents cannot be reversed. Not configurable in this version.",
    },
    inventory__reservationsEnabled: {
      label: "Reservations enabled",
      description:
        "Stock reservations are part of the sales flow in this version; the feature cannot be turned off.",
    },
    inventory__requireReservationBeforeShipment: {
      label: "Require reservation before new shipment",
      description:
        "When on, each open line must be fully reserved before creating a shipment draft. Uses the sales order warehouse.",
    },
    inventory__allocationMode: {
      label: "Allocation mode",
      description:
        "Stock is allocated manually via Allocate stock on the sales order. No automatic allocation mode exists yet.",
    },
    inventory__releaseReservationsOnSalesOrderCancel: {
      label: "Release reservations when sales order is cancelled",
      description:
        "When on, cancelling a draft or confirmed sales order clears active reservations for that order.",
    },
    inventory__releaseReservationsOnSalesOrderClose: {
      label: "Release reservations when sales order closes",
      description:
        "When on, posting a shipment that fully fulfills the order triggers reservation cleanup for the closed sales order. When off, that explicit cleanup is skipped (stale reservations are possible until another reconcile runs).",
    },
    inventory__reconcileReservationsOnSalesOrderSaveConfirm: {
      label: "Reconcile reservations on save and confirm",
      description:
        "When on, saving a draft sales order or confirming it runs reservation reconcile (trim stale or oversized reservations). Shipment validation and allocate-stock still reconcile regardless.",
    },
    commercial__moneyDecimalPlaces: {
      label: "Money rounding (decimals)",
      description: "Half-up rounding for unit prices and line totals on purchase and sales documents (2–4 decimals).",
    },
    commercial__zeroPriceLinesRequireReason: {
      label: "Zero-price lines require a reason",
      description:
        "When off, zero unit price lines are allowed without selecting a reason (draft save, confirm, and health panel).",
    },
    commercial__partnerTermsOverwrite: {
      label: "Partner terms vs document terms",
      description: "Preference for future behavior. Document terms on the PO/SO remain authoritative today.",
    },
    commercial__dueDateFromTermsInfo: {
      label: "Due date from document date + payment terms",
      description:
        "When payment terms (days) are set on a PO or SO, due date is computed from the document date. Changing this rule is not configurable yet.",
    },
    commercial__manualUnitPricePlanningInfo: {
      label: "Unit price on planning documents",
      description:
        "Draft purchase and sales orders allow entering and editing unit prices per line; posted factual documents follow their own rules.",
    },
    dataAudit__auditLogEnabled: {
      label: "Audit log",
      description:
        "Document events are always recorded in this version. Disabling the audit log is not available yet.",
    },
    dataAudit__showAppVersion: {
      label: "Show build info on this page",
      description: "Shows version and build mode below when enabled.",
    },
    dataAudit__backupRestore: {
      label: "Backup & restore",
      description: "Full workspace backup is not available in this version.",
    },
    dataAudit__resetDemo: {
      label: "Reset demo / test data",
      description: "No safe reset flow is wired. Use a fresh profile or reinstall for a clean dataset.",
    },
  },
  options: {
    general__locale: { en: "English", ru: "Русский", kk: "Қазақша" },
    general__theme: { dark: "Dark", system: "System" },
    general__dateFormat: {
      iso: "ISO (YYYY-MM-DD)",
      eu: "EU (DD.MM.YYYY)",
      us: "US (MM/DD/YYYY)",
    },
    general__numberFormat: {
      spaceComma: "1 234,56 (space + comma)",
      commaDot: "1,234.56 (comma + dot)",
      dotComma: "1.234,56 (dot + comma)",
    },
    inventory__allocationMode: { manual: "Manual" },
    commercial__partnerTermsOverwrite: {
      document_wins: "Document terms win",
      master_wins: "Partner master data wins",
    },
  },
} as const;
