import { DEFAULT_APP_SETTINGS } from "./defaults";
import { normalizeAppLocale } from "../i18n/locales";
import type {
  AllocationModeId,
  AppSettings,
  DateFormatId,
  NumberFormatId,
  PartnerTermsOverwriteId,
  ProfileOverridesState,
  ThemePreference,
  WorkspaceModeId,
} from "./types";

export type DeepPartialAppSettings = {
  general?: Partial<AppSettings["general"]>;
  documents?: Partial<AppSettings["documents"]>;
  inventory?: Partial<AppSettings["inventory"]>;
  commercial?: Partial<AppSettings["commercial"]>;
  dataAudit?: Partial<AppSettings["dataAudit"]>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asThemePreference(v: unknown): ThemePreference | undefined {
  return v === "dark" || v === "system" ? v : undefined;
}

function asDateFormatId(v: unknown): DateFormatId | undefined {
  return v === "iso" || v === "eu" || v === "us" ? v : undefined;
}

function asNumberFormatId(v: unknown): NumberFormatId | undefined {
  return v === "spaceComma" || v === "commaDot" || v === "dotComma" ? v : undefined;
}

function asAllocationModeId(v: unknown): AllocationModeId | undefined {
  return v === "manual" ? v : undefined;
}

function asPartnerTermsOverwriteId(v: unknown): PartnerTermsOverwriteId | undefined {
  return v === "document_wins" || v === "master_wins" ? v : undefined;
}

function asWorkspaceModeId(v: unknown): WorkspaceModeId | undefined {
  return v === "lite" || v === "standard" || v === "advanced" ? v : undefined;
}

function coalesceProfileOverride(v: unknown, fallback: boolean | null): boolean | null {
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  return fallback;
}

function normalizeProfileOverridesFromUnknown(
  raw: unknown,
  base: ProfileOverridesState,
): ProfileOverridesState {
  if (!isRecord(raw)) return { ...base };
  const r = raw as Record<string, unknown>;
  return {
    documentEventLog: coalesceProfileOverride(r.documentEventLog, base.documentEventLog),
    reverseDocumentActions: coalesceProfileOverride(r.reverseDocumentActions, base.reverseDocumentActions),
    stockMovementsNav: coalesceProfileOverride(r.stockMovementsNav, base.stockMovementsNav),
    advancedStockBalanceAnalytics: coalesceProfileOverride(
      r.advancedStockBalanceAnalytics,
      base.advancedStockBalanceAnalytics,
    ),
    stockBalanceSourceModal: coalesceProfileOverride(r.stockBalanceSourceModal, base.stockBalanceSourceModal),
    allocationControls: coalesceProfileOverride(r.allocationControls, base.allocationControls),
  };
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

/**
 * Merge persisted blob into defaults; unknown keys ignored; corrupt shapes fall back per-field.
 */
export function normalizeAppSettingsFromUnknown(raw: unknown): AppSettings {
  const base = DEFAULT_APP_SETTINGS;
  if (!isRecord(raw)) return structuredClone(base);

  const g = isRecord(raw.general) ? raw.general : {};
  const d = isRecord(raw.documents) ? raw.documents : {};
  const i = isRecord(raw.inventory) ? raw.inventory : {};
  const c = isRecord(raw.commercial) ? raw.commercial : {};
  const a = isRecord(raw.dataAudit) ? raw.dataAudit : {};

  const legacySingleDraft = asBool(
    (d as Record<string, unknown>).singleDraftFactualPerSource,
  );

  return {
    general: {
      workspaceMode: asWorkspaceModeId(g.workspaceMode) ?? base.general.workspaceMode,
      profileOverrides: normalizeProfileOverridesFromUnknown(
        (g as Record<string, unknown>).profileOverrides,
        base.general.profileOverrides,
      ),
      locale: normalizeAppLocale((g as Record<string, unknown>).locale),
      theme: asThemePreference(g.theme) ?? base.general.theme,
      dateFormat: asDateFormatId(g.dateFormat) ?? base.general.dateFormat,
      numberFormat: asNumberFormatId(g.numberFormat) ?? base.general.numberFormat,
      hotkeysEnabled: asBool(g.hotkeysEnabled) ?? base.general.hotkeysEnabled,
    },
    documents: {
      blockConfirmWhenPlanningHasBlockingErrors:
        asBool(d.blockConfirmWhenPlanningHasBlockingErrors) ??
        base.documents.blockConfirmWhenPlanningHasBlockingErrors,
      blockPostWhenFactualHasBlockingErrors:
        asBool(d.blockPostWhenFactualHasBlockingErrors) ??
        base.documents.blockPostWhenFactualHasBlockingErrors,
      showDocumentEventLog: asBool(d.showDocumentEventLog) ?? base.documents.showDocumentEventLog,
      requireCancelReason: asBool(d.requireCancelReason) ?? base.documents.requireCancelReason,
      requireReversalReason: asBool(d.requireReversalReason) ?? base.documents.requireReversalReason,
      autoClosePlanningOnFullFulfillment:
        asBool(d.autoClosePlanningOnFullFulfillment) ??
        base.documents.autoClosePlanningOnFullFulfillment,
      singleDraftReceiptPerPurchaseOrder:
        asBool(d.singleDraftReceiptPerPurchaseOrder) ??
        legacySingleDraft ??
        base.documents.singleDraftReceiptPerPurchaseOrder,
      singleDraftShipmentPerSalesOrder:
        asBool(d.singleDraftShipmentPerSalesOrder) ??
        legacySingleDraft ??
        base.documents.singleDraftShipmentPerSalesOrder,
    },
    inventory: {
      /** Reservations are always part of the sales flow; persisted false is normalized away. */
      reservationsEnabled: true,
      requireReservationBeforeShipment:
        asBool(i.requireReservationBeforeShipment) ?? base.inventory.requireReservationBeforeShipment,
      allocationMode: asAllocationModeId(i.allocationMode) ?? base.inventory.allocationMode,
      releaseReservationsOnSalesOrderCancel:
        asBool(i.releaseReservationsOnSalesOrderCancel) ??
        base.inventory.releaseReservationsOnSalesOrderCancel,
      releaseReservationsOnSalesOrderClose:
        asBool(i.releaseReservationsOnSalesOrderClose) ??
        base.inventory.releaseReservationsOnSalesOrderClose,
      reconcileReservationsOnSalesOrderSaveConfirm:
        asBool(i.reconcileReservationsOnSalesOrderSaveConfirm) ??
        base.inventory.reconcileReservationsOnSalesOrderSaveConfirm,
    },
    commercial: {
      moneyDecimalPlaces: clampMoneyDecimals(
        asFiniteNumber(c.moneyDecimalPlaces) ?? base.commercial.moneyDecimalPlaces,
      ),
      zeroPriceLinesRequireReason:
        asBool(c.zeroPriceLinesRequireReason) ?? base.commercial.zeroPriceLinesRequireReason,
      partnerTermsOverwrite:
        asPartnerTermsOverwriteId(c.partnerTermsOverwrite) ?? base.commercial.partnerTermsOverwrite,
    },
    dataAudit: {
      /** Document audit events are always recorded; persisted false is normalized away. */
      auditLogEnabled: true,
      showAppVersion: asBool(a.showAppVersion) ?? base.dataAudit.showAppVersion,
    },
  };
}

export function clampMoneyDecimals(n: number): number {
  const r = Math.round(n);
  return Math.min(4, Math.max(2, r));
}

export function mergeAppSettingsPatch(
  current: AppSettings,
  patch: DeepPartialAppSettings,
): AppSettings {
  return {
    general: {
      ...current.general,
      ...patch.general,
      profileOverrides:
        patch.general?.profileOverrides !== undefined
          ? { ...current.general.profileOverrides, ...patch.general.profileOverrides }
          : current.general.profileOverrides,
    },
    documents: { ...current.documents, ...patch.documents },
    inventory: {
      ...current.inventory,
      ...patch.inventory,
      reservationsEnabled: true,
    },
    commercial: {
      ...current.commercial,
      ...patch.commercial,
      moneyDecimalPlaces:
        patch.commercial?.moneyDecimalPlaces !== undefined
          ? clampMoneyDecimals(patch.commercial.moneyDecimalPlaces)
          : current.commercial.moneyDecimalPlaces,
    },
    dataAudit: {
      ...current.dataAudit,
      ...patch.dataAudit,
      auditLogEnabled: true,
    },
  };
}

export function defaultSettingsClone(): AppSettings {
  return structuredClone(DEFAULT_APP_SETTINGS);
}
