import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { MarkingProviderMode } from "../model/markingProviderSettings";
import type { MarkingAutoSyncScope } from "../model/markingAutoSyncSettings";
import {
  getMarkingProviderSettings,
  resetMarkingProviderSettings,
  saveMarkingProviderSettings,
  testMarkingProviderConnection,
} from "../markingProviderSettingsService";
import { getMarkingExternalIntegrationInfo } from "../markingExternalSyncService";
import { getMarkingAutoSyncSettings, saveMarkingAutoSyncSettings } from "../markingAutoSyncSettingsService";
import { getMarkingAutoSyncSchedulerState } from "../markingAutoSyncScheduler";

const MODE_OPTIONS: { value: MarkingProviderMode; labelKey: string }[] = [
  { value: "mock", labelKey: "master.markingProvider.mode.mock" },
  { value: "real", labelKey: "master.markingProvider.mode.real" },
  { value: "disabled", labelKey: "master.markingProvider.mode.disabled" },
];

const AUTO_SCOPE_OPTIONS: { value: MarkingAutoSyncScope; labelKey: string }[] = [
  { value: "problem_only", labelKey: "master.markingAutoSync.scopes.problemOnly" },
  { value: "printed_and_reserved", labelKey: "master.markingAutoSync.scopes.printedReserved" },
  { value: "recent_activity", labelKey: "master.markingAutoSync.scopes.recentActivity" },
  { value: "custom", labelKey: "master.markingAutoSync.scopes.custom" },
];

export function MarkingProviderSettingsPage() {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const persisted = useMemo(() => {
    void revision;
    return getMarkingProviderSettings();
  }, [revision]);

  const [mode, setMode] = useState<MarkingProviderMode>(persisted.mode);
  const [isEnabled, setIsEnabled] = useState(persisted.isEnabled);
  const [providerId, setProviderId] = useState(persisted.providerId);
  const [baseUrl, setBaseUrl] = useState(persisted.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(persisted.apiKey ?? "");
  const [timeoutMs, setTimeoutMs] = useState(String(persisted.timeoutMs ?? 15_000));

  const autoPersisted = useMemo(() => {
    void revision;
    return getMarkingAutoSyncSettings();
  }, [revision]);

  const [autoEnabled, setAutoEnabled] = useState(autoPersisted.isEnabled);
  const [intervalMinutes, setIntervalMinutes] = useState(String(autoPersisted.intervalMinutes));
  const [autoScope, setAutoScope] = useState<MarkingAutoSyncScope>(autoPersisted.scope);
  const [maxRecordsPerRun, setMaxRecordsPerRun] = useState(String(autoPersisted.maxRecordsPerRun));
  const [runOnAppStart, setRunOnAppStart] = useState(autoPersisted.runOnAppStart);
  const [runOnlyWhenProviderEnabled, setRunOnlyWhenProviderEnabled] = useState(autoPersisted.runOnlyWhenProviderEnabled);
  const [runOnlyInRealMode, setRunOnlyInRealMode] = useState(autoPersisted.runOnlyInRealMode);

  useEffect(() => {
    const s = getMarkingProviderSettings();
    setMode(s.mode);
    setIsEnabled(s.isEnabled);
    setProviderId(s.providerId);
    setBaseUrl(s.baseUrl ?? "");
    setApiKey(s.apiKey ?? "");
    setTimeoutMs(String(s.timeoutMs ?? 15_000));
  }, [revision]);

  useEffect(() => {
    const a = getMarkingAutoSyncSettings();
    setAutoEnabled(a.isEnabled);
    setIntervalMinutes(String(a.intervalMinutes));
    setAutoScope(a.scope);
    setMaxRecordsPerRun(String(a.maxRecordsPerRun));
    setRunOnAppStart(a.runOnAppStart);
    setRunOnlyWhenProviderEnabled(a.runOnlyWhenProviderEnabled);
    setRunOnlyInRealMode(a.runOnlyInRealMode);
  }, [revision]);

  const scheduler = useMemo(() => {
    void revision;
    return getMarkingAutoSyncSchedulerState();
  }, [revision]);

  const [testBusy, setTestBusy] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const integration = useMemo(() => {
    void revision;
    return getMarkingExternalIntegrationInfo();
  }, [revision]);

  const handleSave = useCallback(() => {
    const n = Number(timeoutMs);
    saveMarkingProviderSettings({
      mode,
      isEnabled,
      providerId: providerId.trim() || (mode === "mock" ? "mock" : "http"),
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      timeoutMs: Number.isFinite(n) && n > 0 ? Math.floor(n) : 15_000,
    });
    setTestFeedback(null);
  }, [mode, isEnabled, providerId, baseUrl, apiKey, timeoutMs]);

  const handleReset = useCallback(() => {
    resetMarkingProviderSettings();
    setTestFeedback(null);
  }, []);

  const handleSaveAutoSync = useCallback(() => {
    const im = Number(intervalMinutes);
    const mx = Number(maxRecordsPerRun);
    saveMarkingAutoSyncSettings({
      isEnabled: autoEnabled,
      intervalMinutes: Number.isFinite(im) && im > 0 ? Math.floor(im) : 15,
      scope: autoScope,
      maxRecordsPerRun: Number.isFinite(mx) && mx > 0 ? Math.floor(mx) : 50,
      runOnAppStart,
      runOnlyWhenProviderEnabled,
      runOnlyInRealMode,
    });
  }, [
    autoEnabled,
    intervalMinutes,
    autoScope,
    maxRecordsPerRun,
    runOnAppStart,
    runOnlyWhenProviderEnabled,
    runOnlyInRealMode,
  ]);

  const formatSchedulerDetail = useCallback(
    (raw: string | null | undefined) => {
      const m = raw?.trim() ?? "";
      if (!m) return "—";
      const key = `master.markingAutoSync.schedulerMsg.${m}` as const;
      const tr = t(key);
      return tr !== key ? tr : m;
    },
    [t],
  );

  const formatRealHealthError = useCallback(
    (raw: string | undefined) => {
      const m = raw?.trim() ?? "";
      if (m === "not_configured") return t("master.markingProvider.healthErrorNotConfigured");
      if (m === "api_key_required") return t("master.markingProvider.healthErrorApiKeyRequired");
      return m;
    },
    [t],
  );

  const handleTest = useCallback(async () => {
    setTestBusy(true);
    setTestFeedback(null);
    try {
      const n = Number(timeoutMs);
      saveMarkingProviderSettings({
        mode,
        isEnabled,
        providerId: providerId.trim() || (mode === "mock" ? "mock" : "http"),
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        timeoutMs: Number.isFinite(n) && n > 0 ? Math.floor(n) : 15_000,
      });
      const info = getMarkingExternalIntegrationInfo();
      const r = await testMarkingProviderConnection();
      if (info.effectiveLabel === "mock") {
        setTestFeedback(
          r.ok
            ? t("master.markingProvider.testMockOk", { message: r.message ?? "" })
            : t("master.markingProvider.testMockFailed", { message: r.message ?? "" }),
        );
      } else if (info.effectiveLabel === "disabled") {
        setTestFeedback(t("master.markingProvider.testDisabled"));
      } else {
        setTestFeedback(
          r.ok
            ? t("master.markingProvider.testOk", { message: r.message ?? "" })
            : t("master.markingProvider.testFailed", { message: formatRealHealthError(r.message) }),
        );
      }
    } finally {
      setTestBusy(false);
    }
  }, [mode, isEnabled, providerId, baseUrl, apiKey, timeoutMs, t, formatRealHealthError]);

  return (
    <div className="doc-page mx-auto max-w-[920px] space-y-4 p-4 md:p-5">
      <div>
        <p className="text-[11px] text-muted-foreground">
          <Link to="/settings" className="text-primary hover:underline">
            {t("master.markingProvider.backToSettings")}
          </Link>
        </p>
        <h1 className="text-base font-semibold tracking-tight">{t("master.markingProvider.title")}</h1>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{t("master.markingProvider.intro")}</p>
      </div>

      <Card className="border-border/80 bg-card/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("master.markingProvider.statusCardTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("master.markingProvider.statusCardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px]">
              {t("master.markingProvider.activeAdapter")}: {integration.adapterId}
            </span>
            <span className="rounded border border-border px-2 py-0.5 text-[10px]">
              {t("master.markingProvider.modeLabel")}: {t(`master.markingProvider.mode.${integration.mode}`)}
            </span>
            <span
              className={
                integration.effectiveLabel === "mock"
                  ? "rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-950 dark:text-amber-100"
                  : integration.effectiveLabel === "disabled"
                    ? "rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                    : "rounded border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-950 dark:text-sky-100"
              }
            >
              {t(`master.markingProvider.effective.${integration.effectiveLabel}`)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{integration.displayName}</p>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("master.markingProvider.formTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("master.markingProvider.formDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="mp-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
              <Label htmlFor="mp-enabled" className="text-xs">
                {t("master.markingProvider.enabled")}
              </Label>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingProvider.fieldMode")}</Label>
              <SelectField
                value={mode}
                onChange={(v) => setMode(v as MarkingProviderMode)}
                options={MODE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                placeholder=""
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingProvider.fieldProviderId")}</Label>
              <Input value={providerId} onChange={(e) => setProviderId(e.target.value)} className="h-8 font-mono text-xs" placeholder="mock / http" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">{t("master.markingProvider.fieldBaseUrl")}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="h-8 font-mono text-xs"
                placeholder="https://api.example.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingProvider.fieldApiKey")}</Label>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-8 font-mono text-xs"
                placeholder="••••"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingProvider.fieldTimeout")}</Label>
              <Input value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} className="h-8 font-mono text-xs" inputMode="numeric" />
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">{t("master.markingProvider.persistHint")}</div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" onClick={handleSave}>
              {t("master.markingProvider.save")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
              {t("master.markingProvider.reset")}
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" disabled={testBusy} onClick={() => void handleTest()}>
              {testBusy ? t("master.markingProvider.testing") : t("master.markingProvider.testConnection")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <Link to="/items/marking-sync">{t("master.markingProvider.openSyncConsole")}</Link>
            </Button>
          </div>

          {testFeedback ? (
            <div role="status" className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs">
              {testFeedback}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("master.markingAutoSync.cardTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("master.markingAutoSync.cardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-[11px] space-y-1">
            <p className="font-medium">{t("master.markingAutoSync.schedulerStatus")}</p>
            <p>
              {t("master.markingAutoSync.schedulerIntervalActive")}:{" "}
              <span className="font-mono">{scheduler.isRunning ? t("master.markingAutoSync.yes") : t("master.markingAutoSync.no")}</span> ·{" "}
              {t("master.markingAutoSync.autoSyncEnabledSetting")}:{" "}
              <span className="font-mono">{scheduler.isEnabled ? t("master.markingAutoSync.yes") : t("master.markingAutoSync.no")}</span> ·{" "}
              {t("master.markingAutoSync.inFlight")}:{" "}
              <span className="font-mono">{scheduler.inFlight ? t("master.markingAutoSync.yes") : t("master.markingAutoSync.no")}</span>
            </p>
            <p>
              {t("master.markingAutoSync.lastStatus")}: <span className="font-mono">{scheduler.lastStatus}</span>
              {scheduler.lastLogId ? (
                <>
                  {" "}
                  · {t("master.markingAutoSync.lastLog")} #{scheduler.lastLogId}
                </>
              ) : null}
            </p>
            <p>
              {t("master.markingAutoSync.lastDetail")}: {formatSchedulerDetail(scheduler.lastMessage)}
            </p>
            <p>
              {t("master.markingAutoSync.nextRun")}:{" "}
              {scheduler.nextPlannedRunAt
                ? new Date(scheduler.nextPlannedRunAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                : "—"}{" "}
              · {t("master.markingAutoSync.skippedTicks")}: {scheduler.skippedTicksCount}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="mas-enabled" checked={autoEnabled} onCheckedChange={setAutoEnabled} />
              <Label htmlFor="mas-enabled" className="text-xs">
                {t("master.markingAutoSync.enabled")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="mas-run-start" checked={runOnAppStart} onCheckedChange={setRunOnAppStart} />
              <Label htmlFor="mas-run-start" className="text-xs">
                {t("master.markingAutoSync.runOnAppStart")}
              </Label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingAutoSync.intervalMinutes")}</Label>
              <Input
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                className="h-8 font-mono text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("master.markingAutoSync.maxRecords")}</Label>
              <Input
                value={maxRecordsPerRun}
                onChange={(e) => setMaxRecordsPerRun(e.target.value)}
                className="h-8 font-mono text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">{t("master.markingAutoSync.selectionScope")}</Label>
              <SelectField
                value={autoScope}
                onChange={(v) => setAutoScope(v as MarkingAutoSyncScope)}
                options={AUTO_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                placeholder=""
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch id="mas-provider-enabled" checked={runOnlyWhenProviderEnabled} onCheckedChange={setRunOnlyWhenProviderEnabled} />
              <Label htmlFor="mas-provider-enabled" className="text-xs">
                {t("master.markingAutoSync.runOnlyWhenProviderEnabled")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="mas-real-only" checked={runOnlyInRealMode} onCheckedChange={setRunOnlyInRealMode} />
              <Label htmlFor="mas-real-only" className="text-xs">
                {t("master.markingAutoSync.runOnlyInRealMode")}
              </Label>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">{t("master.markingAutoSync.foregroundHint")}</div>

          <Button type="button" size="sm" className="h-8 text-xs" onClick={handleSaveAutoSync}>
            {t("master.markingAutoSync.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
