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
import {
  getMarkingProviderSettings,
  resetMarkingProviderSettings,
  saveMarkingProviderSettings,
  testMarkingProviderConnection,
} from "../markingProviderSettingsService";
import { getMarkingExternalIntegrationInfo } from "../markingExternalSyncService";

const MODE_OPTIONS: { value: MarkingProviderMode; labelKey: string }[] = [
  { value: "mock", labelKey: "master.markingProvider.mode.mock" },
  { value: "real", labelKey: "master.markingProvider.mode.real" },
  { value: "disabled", labelKey: "master.markingProvider.mode.disabled" },
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

  useEffect(() => {
    const s = getMarkingProviderSettings();
    setMode(s.mode);
    setIsEnabled(s.isEnabled);
    setProviderId(s.providerId);
    setBaseUrl(s.baseUrl ?? "");
    setApiKey(s.apiKey ?? "");
    setTimeoutMs(String(s.timeoutMs ?? 15_000));
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
    </div>
  );
}
