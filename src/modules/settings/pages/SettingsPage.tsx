import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import {
  registryEntriesForSection,
  settingsSectionsVisibleForWorkspace,
  useSettings,
  type AppSettings,
  type SettingReadiness,
  type SettingRegistryEntry,
  type SettingsSectionId,
  type SettingsPersistenceState,
} from "@/shared/settings";
import { NULL_PROFILE_OVERRIDES, isWorkspaceFeatureVisible } from "@/shared/workspace";
import { useTranslation, settingRegistryIdToI18nKey, type TFunction } from "@/shared/i18n";
import { WorkspaceProfileSettingsCard } from "../components/WorkspaceProfileSettingsCard";

function SettingsPersistenceNote({
  hydrated,
  persistenceState,
  corruptRestoredOnLoad,
  technicalDetail,
  t,
}: {
  hydrated: boolean;
  persistenceState: SettingsPersistenceState;
  corruptRestoredOnLoad: boolean;
  technicalDetail: string | null;
  t: TFunction;
}) {
  if (!hydrated) return null;

  return (
    <div className="mt-2 space-y-2">
      {persistenceState === "file_persisted" && (
        <p className="text-[11px] text-muted-foreground">{t("settings.persistence.filePersisted")}</p>
      )}

      {persistenceState === "fallback_persisted" && (
        <div className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
          <p className="font-medium text-foreground/85">{t("settings.persistence.fallbackTitle")}</p>
          <p className="mt-0.5 text-[11px]">{t("settings.persistence.fallbackBody")}</p>
        </div>
      )}

      {persistenceState === "defaults_only" && (
        <div className="rounded-md border border-destructive/35 bg-destructive/10 px-2.5 py-2 text-xs leading-snug">
          <p className="font-medium text-foreground">{t("settings.persistence.notSavedTitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("settings.persistence.notSavedBody")}</p>
        </div>
      )}

      {corruptRestoredOnLoad && (
        <p className="text-[11px] text-muted-foreground">{t("settings.persistence.corrupt")}</p>
      )}

      {technicalDetail && (
        <details className="text-[11px] text-muted-foreground/80">
          <summary className="cursor-pointer select-none hover:text-muted-foreground">
            {t("settings.persistence.technicalDetails")}
          </summary>
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono erp-dark-scrollbar">
            {technicalDetail}
          </pre>
        </details>
      )}
    </div>
  );
}

function readinessNote(r: SettingReadiness, t: TFunction): string | null {
  if (r === "active") return null;
  if (r === "partial") return t("readiness.partial");
  if (r === "storedOnly") return t("readiness.storedOnly");
  return t("readiness.informational");
}

function ReadinessBadge({ readiness, t }: { readiness: SettingReadiness; t: TFunction }) {
  const note = readinessNote(readiness, t);
  if (!note) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        readiness === "informational"
          ? "border-border bg-muted/50 text-muted-foreground"
          : readiness === "partial"
            ? "border-sky-500/35 bg-sky-500/10 text-sky-200/90"
            : "border-amber-500/40 bg-amber-500/10 text-amber-200/90",
      )}
      title={
        readiness === "partial"
          ? t("settings.readinessTitle.partial")
          : readiness === "storedOnly"
            ? t("settings.readinessTitle.storedOnly")
            : t("settings.readinessTitle.informational")
      }
    >
      {note}
    </span>
  );
}

function persistenceStateSummary(state: SettingsPersistenceState, t: TFunction): string {
  switch (state) {
    case "file_persisted":
      return t("settings.persistence.summaryFile");
    case "fallback_persisted":
      return t("settings.persistence.summaryBrowser");
    case "defaults_only":
      return t("settings.persistence.summaryNone");
    default: {
      const _x: never = state;
      return _x;
    }
  }
}

function getSettingValue(settings: AppSettings, entry: SettingRegistryEntry): unknown {
  switch (entry.id) {
    case "general.locale":
      return settings.general.locale;
    case "general.theme":
      return settings.general.theme;
    case "general.dateFormat":
      return settings.general.dateFormat;
    case "general.numberFormat":
      return settings.general.numberFormat;
    case "general.hotkeysEnabled":
      return settings.general.hotkeysEnabled;
    case "documents.blockConfirmWhenPlanningHasBlockingErrors":
      return settings.documents.blockConfirmWhenPlanningHasBlockingErrors;
    case "documents.blockPostWhenFactualHasBlockingErrors":
      return settings.documents.blockPostWhenFactualHasBlockingErrors;
    case "documents.showDocumentEventLog":
      return settings.documents.showDocumentEventLog;
    case "documents.requireCancelReason":
      return settings.documents.requireCancelReason;
    case "documents.requireReversalReason":
      return settings.documents.requireReversalReason;
    case "documents.autoClosePlanningOnFullFulfillment":
      return settings.documents.autoClosePlanningOnFullFulfillment;
    case "documents.singleDraftReceiptPerPurchaseOrder":
      return settings.documents.singleDraftReceiptPerPurchaseOrder;
    case "documents.singleDraftShipmentPerSalesOrder":
      return settings.documents.singleDraftShipmentPerSalesOrder;
    case "inventory.reservationsEnabled":
      return settings.inventory.reservationsEnabled;
    case "inventory.requireReservationBeforeShipment":
      return settings.inventory.requireReservationBeforeShipment;
    case "inventory.allocationMode":
      return settings.inventory.allocationMode;
    case "inventory.releaseReservationsOnSalesOrderCancel":
      return settings.inventory.releaseReservationsOnSalesOrderCancel;
    case "inventory.releaseReservationsOnSalesOrderClose":
      return settings.inventory.releaseReservationsOnSalesOrderClose;
    case "inventory.reconcileReservationsOnSalesOrderSaveConfirm":
      return settings.inventory.reconcileReservationsOnSalesOrderSaveConfirm;
    case "commercial.moneyDecimalPlaces":
      return settings.commercial.moneyDecimalPlaces;
    case "commercial.zeroPriceLinesRequireReason":
      return settings.commercial.zeroPriceLinesRequireReason;
    case "commercial.partnerTermsOverwrite":
      return settings.commercial.partnerTermsOverwrite;
    case "dataAudit.auditLogEnabled":
      return settings.dataAudit.auditLogEnabled;
    case "dataAudit.showAppVersion":
      return settings.dataAudit.showAppVersion;
    default:
      return null;
  }
}

export function SettingsPage() {
  const { t } = useTranslation();
  const {
    settings,
    patch,
    resetSection,
    hydrated,
    persistenceState,
    corruptRestoredOnLoad,
    persistenceTechnicalDetail,
  } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("workspaceProfile");
  const workspaceMode = settings.general.workspaceMode;

  const visibleSettingsSections = useMemo(
    () => settingsSectionsVisibleForWorkspace(workspaceMode),
    [workspaceMode],
  );

  useEffect(() => {
    if (!visibleSettingsSections.includes(activeSection)) {
      setActiveSection(visibleSettingsSections[0] ?? "workspaceProfile");
    }
  }, [visibleSettingsSections, activeSection]);

  const onBoolean = useCallback(
    (entry: SettingRegistryEntry, checked: boolean) => {
      switch (entry.id) {
        case "general.hotkeysEnabled":
          patch({ general: { hotkeysEnabled: checked } });
          break;
        case "documents.blockConfirmWhenPlanningHasBlockingErrors":
          patch({ documents: { blockConfirmWhenPlanningHasBlockingErrors: checked } });
          break;
        case "documents.blockPostWhenFactualHasBlockingErrors":
          patch({ documents: { blockPostWhenFactualHasBlockingErrors: checked } });
          break;
        case "documents.showDocumentEventLog":
          patch({ documents: { showDocumentEventLog: checked } });
          break;
        case "documents.requireCancelReason":
          patch({ documents: { requireCancelReason: checked } });
          break;
        case "documents.requireReversalReason":
          patch({ documents: { requireReversalReason: checked } });
          break;
        case "documents.autoClosePlanningOnFullFulfillment":
          patch({ documents: { autoClosePlanningOnFullFulfillment: checked } });
          break;
        case "documents.singleDraftReceiptPerPurchaseOrder":
          patch({ documents: { singleDraftReceiptPerPurchaseOrder: checked } });
          break;
        case "documents.singleDraftShipmentPerSalesOrder":
          patch({ documents: { singleDraftShipmentPerSalesOrder: checked } });
          break;
        case "inventory.reservationsEnabled":
          patch({ inventory: { reservationsEnabled: checked } });
          break;
        case "inventory.requireReservationBeforeShipment":
          patch({ inventory: { requireReservationBeforeShipment: checked } });
          break;
        case "inventory.releaseReservationsOnSalesOrderCancel":
          patch({ inventory: { releaseReservationsOnSalesOrderCancel: checked } });
          break;
        case "inventory.releaseReservationsOnSalesOrderClose":
          patch({ inventory: { releaseReservationsOnSalesOrderClose: checked } });
          break;
        case "inventory.reconcileReservationsOnSalesOrderSaveConfirm":
          patch({ inventory: { reconcileReservationsOnSalesOrderSaveConfirm: checked } });
          break;
        case "commercial.zeroPriceLinesRequireReason":
          patch({ commercial: { zeroPriceLinesRequireReason: checked } });
          break;
        case "dataAudit.auditLogEnabled":
          patch({ dataAudit: { auditLogEnabled: checked } });
          break;
        case "dataAudit.showAppVersion":
          patch({ dataAudit: { showAppVersion: checked } });
          break;
        default:
          break;
      }
    },
    [patch],
  );

  const onEnum = useCallback(
    (entry: SettingRegistryEntry, value: string) => {
      switch (entry.id) {
        case "general.locale":
          patch({ general: { locale: value as AppSettings["general"]["locale"] } });
          break;
        case "general.theme":
          patch({ general: { theme: value as AppSettings["general"]["theme"] } });
          break;
        case "general.dateFormat":
          patch({ general: { dateFormat: value as AppSettings["general"]["dateFormat"] } });
          break;
        case "general.numberFormat":
          patch({ general: { numberFormat: value as AppSettings["general"]["numberFormat"] } });
          break;
        case "inventory.allocationMode":
          patch({ inventory: { allocationMode: value as AppSettings["inventory"]["allocationMode"] } });
          break;
        case "commercial.partnerTermsOverwrite":
          patch({
            commercial: {
              partnerTermsOverwrite: value as AppSettings["commercial"]["partnerTermsOverwrite"],
            },
          });
          break;
        default:
          break;
      }
    },
    [patch],
  );

  const onNumber = useCallback(
    (entry: SettingRegistryEntry, raw: string) => {
      const n = Number(raw);
      if (entry.id === "commercial.moneyDecimalPlaces" && Number.isFinite(n)) {
        patch({ commercial: { moneyDecimalPlaces: n } });
      }
    },
    [patch],
  );

  const sectionEntries = useMemo(
    () => registryEntriesForSection(activeSection, workspaceMode),
    [activeSection, workspaceMode],
  );

  return (
    <div className="settings-page flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("settings.page.title")}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("settings.page.subtitle")}</p>
        {!hydrated && (
          <p className="mt-2 text-xs text-muted-foreground">{t("settings.page.loading")}</p>
        )}
        <SettingsPersistenceNote
          hydrated={hydrated}
          persistenceState={persistenceState}
          corruptRestoredOnLoad={corruptRestoredOnLoad}
          technicalDetail={persistenceTechnicalDetail}
          t={t}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <nav
          className="settings-page__nav flex w-44 shrink-0 flex-col gap-0.5 border-r border-border pr-3"
          aria-label={t("settings.page.title")}
        >
          {visibleSettingsSections.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                activeSection === id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {t(`settings.sections.${id}.title`)}
            </button>
          ))}
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto erp-dark-scrollbar">
          {activeSection === "workspaceProfile" ? (
            <>
              <WorkspaceProfileSettingsCard
                workspaceMode={workspaceMode}
                profileOverrides={settings.general.profileOverrides}
                requireReservationBeforeShipment={settings.inventory.requireReservationBeforeShipment}
                onSelectMode={(mode) => patch({ general: { workspaceMode: mode } })}
                onPatchProfileOverrides={(next) => patch({ general: { profileOverrides: next } })}
                onResetProfileOverrides={() =>
                  patch({ general: { profileOverrides: { ...NULL_PROFILE_OVERRIDES } } })
                }
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => resetSection("workspaceProfile")}
                >
                  {t("settings.page.resetSection")}
                </Button>
              </div>
            </>
          ) : (
            <>
          <Card className="border-border/80 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`settings.sections.${activeSection}.title`)}</CardTitle>
              <CardDescription className="text-xs">{t(`settings.sections.${activeSection}.description`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/80 pb-4">
              {sectionEntries.map((entry) => {
                const value = getSettingValue(settings, entry);
                const boolDisabled = entry.readiness === "informational";
                const i18nKey = settingRegistryIdToI18nKey(entry.id);
                const entryLabel = t(`settings.entries.${i18nKey}.label`);
                const entryDescription = t(`settings.entries.${i18nKey}.description`);

                if (entry.valueType === "readonly") {
                  return (
                    <div key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-sm font-medium text-foreground">{entryLabel}</Label>
                          <ReadinessBadge readiness={entry.readiness} t={t} />
                        </div>
                        <p className="text-xs text-muted-foreground">{entryDescription}</p>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">—</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-sm font-medium text-foreground" htmlFor={entry.id}>
                          {entryLabel}
                        </Label>
                        <ReadinessBadge readiness={entry.readiness} t={t} />
                      </div>
                      <p className="text-xs text-muted-foreground">{entryDescription}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      {entry.valueType === "boolean" && (
                        <Switch
                          id={entry.id}
                          checked={Boolean(value)}
                          disabled={boolDisabled}
                          onCheckedChange={(c) => onBoolean(entry, c)}
                          aria-label={entryLabel}
                        />
                      )}
                      {entry.valueType === "enum" && entry.options && (
                        <SelectField
                          id={entry.id}
                          value={String(value ?? "")}
                          onChange={(v) => onEnum(entry, v)}
                          options={entry.options.map((o) => ({
                            value: o.value,
                            label: t(`settings.options.${i18nKey}.${o.value}`),
                          }))}
                          placeholder={t("common.select")}
                          disabled={
                            entry.readiness === "informational" ||
                            (entry.id === "inventory.allocationMode" && entry.options.length <= 1)
                          }
                          aria-label={entryLabel}
                          className="w-[min(100%,280px)]"
                        />
                      )}
                      {entry.valueType === "number" && (
                        <Input
                          id={entry.id}
                          type="number"
                          min={entry.numberMin}
                          max={entry.numberMax}
                          className="h-8 w-24 font-mono text-sm"
                          value={String(value ?? "")}
                          disabled={
                            entry.readiness !== "active" && entry.readiness !== "partial"
                          }
                          onChange={(e) => onNumber(entry, e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {activeSection === "dataAudit" &&
                isWorkspaceFeatureVisible(workspaceMode, "settingsDataAudit") &&
                hydrated && (
                <div className="flex flex-col gap-1 border-t border-border/80 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1 pr-4">
                    <Label className="text-sm font-medium text-foreground">
                      {t("settings.page.persistenceLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t("settings.page.persistenceWhere")}</p>
                  </div>
                  <div className="shrink-0 text-xs font-medium text-foreground/90">
                    {persistenceStateSummary(persistenceState, t)}
                  </div>
                </div>
              )}

              {activeSection === "dataAudit" &&
                isWorkspaceFeatureVisible(workspaceMode, "settingsDataAudit") &&
                settings.dataAudit.showAppVersion && (
                <div className="flex flex-col gap-1 border-t border-border/80 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1 pr-4">
                    <Label className="text-sm font-medium text-foreground">{t("settings.page.buildInfoLabel")}</Label>
                    <p className="text-xs text-muted-foreground">{t("settings.page.buildInfoDesc")}</p>
                  </div>
                  <div className="shrink-0 font-mono text-xs text-muted-foreground">
                    {import.meta.env.DEV ? "development" : "production"} · vite
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => resetSection(activeSection)}
            >
              {t("settings.page.resetSection")}
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
