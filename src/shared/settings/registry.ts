import type { SettingRegistryEntry, SettingsSectionId, WorkspaceModeId } from "./types";
import { workspaceModeAtLeast } from "../workspace/workspaceMode";

export const SETTINGS_SECTION_META: Record<
  SettingsSectionId,
  { title: string; description: string }
> = {
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
};

/** Ordered sections for navigation + rendering. Workspace profile is virtual (no registry rows). */
export const SETTINGS_SECTION_ORDER: SettingsSectionId[] = [
  "workspaceProfile",
  "general",
  "documents",
  "inventory",
  "commercial",
  "dataAudit",
];

export const SETTINGS_REGISTRY: SettingRegistryEntry[] = [
  {
    id: "general.locale",
    section: "general",
    valueType: "enum",
    label: "Language",
    description: "User interface language. Applies immediately across the app.",
    readiness: "active",
    options: [
      { value: "en", label: "English" },
      { value: "ru", label: "Русский" },
      { value: "kk", label: "Қазақша" },
    ],
  },
  {
    id: "general.theme",
    section: "general",
    valueType: "enum",
    label: "Theme",
    description: "Dark keeps the standard ERP look. System follows your OS light/dark mode.",
    readiness: "active",
    options: [
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
  },
  {
    id: "general.dateFormat",
    section: "general",
    valueType: "enum",
    label: "Date format",
    description: "Stored for future use. Dates on screens are not yet fully driven by this setting.",
    readiness: "storedOnly",
    options: [
      { value: "iso", label: "ISO (YYYY-MM-DD)" },
      { value: "eu", label: "EU (DD.MM.YYYY)" },
      { value: "us", label: "US (MM/DD/YYYY)" },
    ],
  },
  {
    id: "general.numberFormat",
    section: "general",
    valueType: "enum",
    label: "Number format",
    description: "Stored for future use. Grid and entry formatting still use the app default.",
    readiness: "storedOnly",
    options: [
      { value: "spaceComma", label: "1 234,56 (space + comma)" },
      { value: "commaDot", label: "1,234.56 (comma + dot)" },
      { value: "dotComma", label: "1.234,56 (dot + comma)" },
    ],
  },
  {
    id: "general.hotkeysEnabled",
    section: "general",
    valueType: "boolean",
    label: "Keyboard shortcuts",
    description: "List search (/) and document shortcuts (save, add line, import, allocate).",
    readiness: "active",
  },

  {
    id: "documents.blockConfirmWhenPlanningHasBlockingErrors",
    section: "documents",
    valueType: "boolean",
    label: "Block Confirm when planning has errors",
    description:
      "Purchase order and sales order: disable Confirm while the document health strip shows blocking errors. Turning off allows Confirm from the header; the server still validates before confirming.",
    readiness: "partial",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.blockPostWhenFactualHasBlockingErrors",
    section: "documents",
    valueType: "boolean",
    label: "Block Post when receipt/shipment has errors",
    description:
      "Receipt and shipment: disable Post while full validation reports blocking errors (same checks as posting). Turning off allows attempting Post from the header; the server still rejects invalid posts.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.showDocumentEventLog",
    section: "documents",
    valueType: "boolean",
    label: "Show event log on document pages",
    description:
      "Shows the audit event list on purchase order, sales order, receipt, and shipment pages. Events are always stored; this only affects visibility.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.requireCancelReason",
    section: "documents",
    valueType: "boolean",
    label: "Require cancel reason",
    description:
      "When on, cancelling a draft planning or factual document requires selecting a reason. When off, cancellation still records reason code “Other” if none is chosen.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.requireReversalReason",
    section: "documents",
    valueType: "boolean",
    label: "Require reversal reason",
    description:
      "When on, reversing a posted receipt or shipment requires a reason. When off, “Other” is stored if none is chosen.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.autoClosePlanningOnFullFulfillment",
    section: "documents",
    valueType: "boolean",
    label: "Close planning when fully fulfilled",
    description:
      "When on, posting the receipt or shipment that completes all open lines sets the purchase order or sales order to Closed. When off, it stays Confirmed even after full fulfillment.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.singleDraftReceiptPerPurchaseOrder",
    section: "documents",
    valueType: "boolean",
    label: "Allow only one draft receipt per purchase order",
    description: "When on, you cannot create a second draft receipt for the same confirmed PO until the first is posted or cancelled.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.singleDraftShipmentPerSalesOrder",
    section: "documents",
    valueType: "boolean",
    label: "Allow only one draft shipment per sales order",
    description: "When on, you cannot create a second draft shipment for the same confirmed SO until the first is posted or cancelled.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "documents.reversalOnlyFromPosted",
    section: "documents",
    valueType: "readonly",
    label: "Reversal only from posted status",
    description:
      "Posted receipts and shipments may be fully reversed once (reason recorded); draft or cancelled documents cannot be reversed. Not configurable in this version.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },

  {
    id: "inventory.reservationsEnabled",
    section: "inventory",
    valueType: "boolean",
    label: "Reservations enabled",
    description: "Stock reservations are part of the sales flow in this version; the feature cannot be turned off.",
    readiness: "informational",
    minWorkspaceMode: "advanced",
  },
  {
    id: "inventory.requireReservationBeforeShipment",
    section: "inventory",
    valueType: "boolean",
    label: "Require reservation before new shipment",
    description:
      "When on, each open line must be fully reserved before creating a shipment draft. Uses the sales order warehouse.",
    readiness: "active",
    minWorkspaceMode: "advanced",
  },
  {
    id: "inventory.allocationMode",
    section: "inventory",
    valueType: "enum",
    label: "Allocation mode",
    description: "Stock is allocated manually via Allocate stock on the sales order. No automatic allocation mode exists yet.",
    readiness: "informational",
    options: [{ value: "manual", label: "Manual" }],
    minWorkspaceMode: "advanced",
  },
  {
    id: "inventory.releaseReservationsOnSalesOrderCancel",
    section: "inventory",
    valueType: "boolean",
    label: "Release reservations when sales order is cancelled",
    description: "When on, cancelling a draft or confirmed sales order clears active reservations for that order.",
    readiness: "active",
    minWorkspaceMode: "advanced",
  },
  {
    id: "inventory.releaseReservationsOnSalesOrderClose",
    section: "inventory",
    valueType: "boolean",
    label: "Release reservations when sales order closes",
    description:
      "When on, posting a shipment that fully fulfills the order triggers reservation cleanup for the closed sales order. When off, that explicit cleanup is skipped (stale reservations are possible until another reconcile runs).",
    readiness: "partial",
    minWorkspaceMode: "advanced",
  },
  {
    id: "inventory.reconcileReservationsOnSalesOrderSaveConfirm",
    section: "inventory",
    valueType: "boolean",
    label: "Reconcile reservations on save and confirm",
    description:
      "When on, saving a draft sales order or confirming it runs reservation reconcile (trim stale or oversized reservations). Shipment validation and allocate-stock still reconcile regardless.",
    readiness: "partial",
    minWorkspaceMode: "advanced",
  },

  {
    id: "commercial.moneyDecimalPlaces",
    section: "commercial",
    valueType: "number",
    label: "Money rounding (decimals)",
    description: "Half-up rounding for unit prices and line totals on purchase and sales documents (2–4 decimals).",
    readiness: "active",
    numberMin: 2,
    numberMax: 4,
  },
  {
    id: "commercial.zeroPriceLinesRequireReason",
    section: "commercial",
    valueType: "boolean",
    label: "Zero-price lines require a reason",
    description: "When off, zero unit price lines are allowed without selecting a reason (draft save, confirm, and health panel).",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "commercial.partnerTermsOverwrite",
    section: "commercial",
    valueType: "enum",
    label: "Partner terms vs document terms",
    description: "Preference for future behavior. Document terms on the PO/SO remain authoritative today.",
    readiness: "storedOnly",
    options: [
      { value: "document_wins", label: "Document terms win" },
      { value: "master_wins", label: "Partner master data wins" },
    ],
    minWorkspaceMode: "standard",
  },
  {
    id: "commercial.dueDateFromTermsInfo",
    section: "commercial",
    valueType: "readonly",
    label: "Due date from document date + payment terms",
    description:
      "When payment terms (days) are set on a PO or SO, due date is computed from the document date. Changing this rule is not configurable yet.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },
  {
    id: "commercial.manualUnitPricePlanningInfo",
    section: "commercial",
    valueType: "readonly",
    label: "Unit price on planning documents",
    description: "Draft purchase and sales orders allow entering and editing unit prices per line; posted factual documents follow their own rules.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },

  {
    id: "dataAudit.auditLogEnabled",
    section: "dataAudit",
    valueType: "boolean",
    label: "Audit log",
    description: "Document events are always recorded in this version. Disabling the audit log is not available yet.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },
  {
    id: "dataAudit.showAppVersion",
    section: "dataAudit",
    valueType: "boolean",
    label: "Show build info on this page",
    description: "Shows version and build mode below when enabled.",
    readiness: "active",
    minWorkspaceMode: "standard",
  },
  {
    id: "dataAudit.backupRestore",
    section: "dataAudit",
    valueType: "readonly",
    label: "Backup & restore",
    description: "Full workspace backup is not available in this version.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },
  {
    id: "dataAudit.resetDemo",
    section: "dataAudit",
    valueType: "readonly",
    label: "Reset demo / test data",
    description: "No safe reset flow is wired. Use a fresh profile or reinstall for a clean dataset.",
    readiness: "informational",
    minWorkspaceMode: "standard",
  },
];

export function isRegistryEntryVisibleForWorkspace(
  entry: SettingRegistryEntry,
  mode: WorkspaceModeId,
): boolean {
  const min = entry.minWorkspaceMode;
  if (min == null) return true;
  return workspaceModeAtLeast(mode, min);
}

export function registryEntriesForSection(
  section: SettingsSectionId,
  workspaceMode: WorkspaceModeId,
): SettingRegistryEntry[] {
  return SETTINGS_REGISTRY.filter(
    (r) => r.section === section && isRegistryEntryVisibleForWorkspace(r, workspaceMode),
  );
}

/** Sections shown in Settings nav: workspace profile always; other sections when they have visible rows. */
export function settingsSectionsVisibleForWorkspace(mode: WorkspaceModeId): SettingsSectionId[] {
  return SETTINGS_SECTION_ORDER.filter((id) => {
    if (id === "workspaceProfile") return true;
    return registryEntriesForSection(id, mode).length > 0;
  });
}
