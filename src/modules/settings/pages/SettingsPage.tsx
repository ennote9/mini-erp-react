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
  SETTINGS_SECTION_META,
  settingsSectionsVisibleForWorkspace,
  useSettings,
  type AppSettings,
  type SettingReadiness,
  type SettingRegistryEntry,
  type SettingsSectionId,
  type SettingsPersistenceState,
} from "@/shared/settings";
import { NULL_PROFILE_OVERRIDES, isWorkspaceFeatureVisible } from "@/shared/workspace";
import { WorkspaceProfileSettingsCard } from "../components/WorkspaceProfileSettingsCard";

function SettingsPersistenceNote({
  hydrated,
  persistenceState,
  corruptRestoredOnLoad,
  technicalDetail,
}: {
  hydrated: boolean;
  persistenceState: SettingsPersistenceState;
  corruptRestoredOnLoad: boolean;
  technicalDetail: string | null;
}) {
  if (!hydrated) return null;

  return (
    <div className="mt-2 space-y-2">
      {persistenceState === "file_persisted" && (
        <p className="text-[11px] text-muted-foreground">Saved locally (app data folder).</p>
      )}

      {persistenceState === "fallback_persisted" && (
        <div className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
          <p className="font-medium text-foreground/85">Using browser storage</p>
          <p className="mt-0.5 text-[11px]">
            App data file isn’t available; settings are stored in browser storage and still apply for this app.
          </p>
        </div>
      )}

      {persistenceState === "defaults_only" && (
        <div className="rounded-md border border-destructive/35 bg-destructive/10 px-2.5 py-2 text-xs leading-snug">
          <p className="font-medium text-foreground">Settings are not being saved</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Changes may be lost when you close the app. Check storage access or permissions.
          </p>
        </div>
      )}

      {corruptRestoredOnLoad && (
        <p className="text-[11px] text-muted-foreground">
          The previous settings file was invalid and was replaced with defaults.
        </p>
      )}

      {technicalDetail && (
        <details className="text-[11px] text-muted-foreground/80">
          <summary className="cursor-pointer select-none hover:text-muted-foreground">Technical details</summary>
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono erp-dark-scrollbar">
            {technicalDetail}
          </pre>
        </details>
      )}
    </div>
  );
}

function readinessNote(r: SettingReadiness): string | null {
  if (r === "active") return null;
  if (r === "partial") return "Partial";
  if (r === "storedOnly") return "Saved only";
  return "Info";
}

function ReadinessBadge({ readiness }: { readiness: SettingReadiness }) {
  const note = readinessNote(readiness);
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
          ? "Works for some paths; see description for limits."
          : readiness === "storedOnly"
            ? "Value is stored but not read by business logic yet."
            : "Explains current system behavior; not a live toggle."
      }
    >
      {note}
    </span>
  );
}

function persistenceStateSummary(state: SettingsPersistenceState): string {
  switch (state) {
    case "file_persisted":
      return "App data file";
    case "fallback_persisted":
      return "Browser storage (fallback)";
    case "defaults_only":
      return "Not saved (this session only)";
    default: {
      const _x: never = state;
      return _x;
    }
  }
}

function getSettingValue(settings: AppSettings, entry: SettingRegistryEntry): unknown {
  switch (entry.id) {
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

  const meta = SETTINGS_SECTION_META[activeSection];

  return (
    <div className="settings-page flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Settings</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Workspace preferences and system rules. Changes apply immediately when persistence is available.
        </p>
        {!hydrated && (
          <p className="mt-2 text-xs text-muted-foreground">Loading saved settings…</p>
        )}
        <SettingsPersistenceNote
          hydrated={hydrated}
          persistenceState={persistenceState}
          corruptRestoredOnLoad={corruptRestoredOnLoad}
          technicalDetail={persistenceTechnicalDetail}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <nav
          className="settings-page__nav flex w-44 shrink-0 flex-col gap-0.5 border-r border-border pr-3"
          aria-label="Settings sections"
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
              {SETTINGS_SECTION_META[id].title}
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
                  Reset this section to defaults
                </Button>
              </div>
            </>
          ) : (
            <>
          <Card className="border-border/80 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{meta.title}</CardTitle>
              <CardDescription className="text-xs">{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/80 pb-4">
              {sectionEntries.map((entry) => {
                const value = getSettingValue(settings, entry);
                const boolDisabled = entry.readiness === "informational";

                if (entry.valueType === "readonly") {
                  return (
                    <div key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-sm font-medium text-foreground">{entry.label}</Label>
                          <ReadinessBadge readiness={entry.readiness} />
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.description}</p>
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
                          {entry.label}
                        </Label>
                        <ReadinessBadge readiness={entry.readiness} />
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      {entry.valueType === "boolean" && (
                        <Switch
                          id={entry.id}
                          checked={Boolean(value)}
                          disabled={boolDisabled}
                          onCheckedChange={(c) => onBoolean(entry, c)}
                          aria-label={entry.label}
                        />
                      )}
                      {entry.valueType === "enum" && entry.options && (
                        <SelectField
                          id={entry.id}
                          value={String(value ?? "")}
                          onChange={(v) => onEnum(entry, v)}
                          options={[...entry.options]}
                          placeholder="Select"
                          disabled={
                            entry.readiness === "informational" ||
                            (entry.id === "inventory.allocationMode" && entry.options.length <= 1)
                          }
                          aria-label={entry.label}
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
                    <Label className="text-sm font-medium text-foreground">Settings persistence</Label>
                    <p className="text-xs text-muted-foreground">
                      Where these preferences are stored on this device (same as the status note at the top of this page).
                    </p>
                  </div>
                  <div className="shrink-0 text-xs font-medium text-foreground/90">
                    {persistenceStateSummary(persistenceState)}
                  </div>
                </div>
              )}

              {activeSection === "dataAudit" &&
                isWorkspaceFeatureVisible(workspaceMode, "settingsDataAudit") &&
                settings.dataAudit.showAppVersion && (
                <div className="flex flex-col gap-1 border-t border-border/80 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1 pr-4">
                    <Label className="text-sm font-medium text-foreground">Application</Label>
                    <p className="text-xs text-muted-foreground">Build mode for this front-end bundle.</p>
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
              Reset this section to defaults
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
