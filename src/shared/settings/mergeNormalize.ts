import { DEFAULT_APP_SETTINGS } from "./defaults";
import { normalizeAppLocale } from "../i18n/locales";
import type {
  AppSettings,
  DateFormatId,
  NumberFormatId,
  PartnerTermsOverwriteId,
  ThemePreference,
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
  return v === "light" || v === "dark" || v === "system" ? v : undefined;
}

function asDateFormatId(v: unknown): DateFormatId | undefined {
  return v === "iso" || v === "eu" || v === "us" ? v : undefined;
}

function asNumberFormatId(v: unknown): NumberFormatId | undefined {
  return v === "spaceComma" || v === "commaDot" || v === "dotComma" ? v : undefined;
}

function asPartnerTermsOverwriteId(v: unknown): PartnerTermsOverwriteId | undefined {
  return v === "document_wins" || v === "master_wins" ? v : undefined;
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
  const c = isRecord(raw.commercial) ? raw.commercial : {};
  const a = isRecord(raw.dataAudit) ? raw.dataAudit : {};

  return {
    general: {
      // Product-canonical: keep maximal workspace visibility regardless of persisted non-general config.
      workspaceMode: base.general.workspaceMode,
      profileOverrides: { ...base.general.profileOverrides },
      locale: normalizeAppLocale((g as Record<string, unknown>).locale),
      theme: asThemePreference(g.theme) ?? base.general.theme,
      dateFormat: asDateFormatId(g.dateFormat) ?? base.general.dateFormat,
      numberFormat: asNumberFormatId(g.numberFormat) ?? base.general.numberFormat,
      hotkeysEnabled: asBool(g.hotkeysEnabled) ?? base.general.hotkeysEnabled,
    },
    documents: {
      // Product-canonical process guards (non-General settings are not user-configurable).
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
      /** Reservations are always part of the sales flow; persisted false is normalized away. */
      reservationsEnabled: true,
      requireReservationBeforeShipment: true,
      allocationMode: base.inventory.allocationMode,
      releaseReservationsOnSalesOrderCancel: true,
      releaseReservationsOnSalesOrderClose: true,
      reconcileReservationsOnSalesOrderSaveConfirm: true,
    },
    commercial: {
      moneyDecimalPlaces: clampMoneyDecimals(
        asFiniteNumber(c.moneyDecimalPlaces) ?? base.commercial.moneyDecimalPlaces,
      ),
      zeroPriceLinesRequireReason: true,
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
      // Product-canonical: keep maximal workspace visibility.
      workspaceMode: current.general.workspaceMode,
      profileOverrides: current.general.profileOverrides,
    },
    documents: {
      ...current.documents,
      ...patch.documents,
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
      ...current.inventory,
      ...patch.inventory,
      reservationsEnabled: true,
      requireReservationBeforeShipment: true,
      allocationMode: current.inventory.allocationMode,
      releaseReservationsOnSalesOrderCancel: true,
      releaseReservationsOnSalesOrderClose: true,
      reconcileReservationsOnSalesOrderSaveConfirm: true,
    },
    commercial: {
      ...current.commercial,
      ...patch.commercial,
      moneyDecimalPlaces:
        patch.commercial?.moneyDecimalPlaces !== undefined
          ? clampMoneyDecimals(patch.commercial.moneyDecimalPlaces)
          : current.commercial.moneyDecimalPlaces,
      zeroPriceLinesRequireReason: true,
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
