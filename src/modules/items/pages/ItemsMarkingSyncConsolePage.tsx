import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { MarkingIntegrationModeBanner } from "../components/MarkingIntegrationModeBanner";
import type { MarkingSyncLogAction, MarkingSyncLogEntry, MarkingSyncLogStatus } from "../model/markingExternalSync";
import { parseSyncLogDetails } from "../lib/markingSyncLogPayload";
import { markingSyncLogRepository } from "../markingSyncLogRepository";
import {
  confirmMarkingRecordsUsedExternally,
  getMarkingExternalIntegrationInfo,
  rerunMarkingSyncLogEntry,
  syncByBatchRef,
  syncByPrintJob,
  syncMarkingRecords,
  type MarkingExternalSyncRunResult,
  voidMarkingRecordsExternally,
} from "../markingExternalSyncService";
import { getMarkingAutoSyncSchedulerState, runMarkingAutoSyncNow } from "../markingAutoSyncScheduler";
import type { MarkingSyncLogTrigger } from "../lib/markingSyncLogPayload";
import { analyzeMarkingReconciliation, buildReconciliationContext } from "../lib/markingExternalReconciliation";
import { buildVoidCountsByBatchRef, buildVoidCountsByItemId } from "../lib/markingTraceabilityReporting";
import { getMarkingRecordLastPrintAudit } from "../markingRecordService";
import { markingRecordRepository } from "../markingRecordRepository";

const ACTIONS: MarkingSyncLogAction[] = ["FETCH_STATUS", "CONFIRM_USED", "VOID_EXTERNAL", "BATCH_BY_REF", "BATCH_BY_JOB"];
const STATUSES: MarkingSyncLogStatus[] = ["SUCCESS", "PARTIAL", "FAILED"];

function parseIds(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function logMatchesFilters(
  e: MarkingSyncLogEntry,
  f: {
    providerQ: string;
    action: "" | MarkingSyncLogAction;
    status: "" | MarkingSyncLogStatus;
    recordQ: string;
    jobQ: string;
    batchQ: string;
    from: string;
    to: string;
    trigger: "" | MarkingSyncLogTrigger;
    unresolvedRecordIds: ReadonlySet<string> | null;
  },
): boolean {
  if (f.unresolvedRecordIds && f.unresolvedRecordIds.size > 0) {
    if (!e.recordIds.some((id) => f.unresolvedRecordIds!.has(id))) return false;
  }
  if (f.providerQ && !e.provider.toLowerCase().includes(f.providerQ.toLowerCase())) return false;
  if (f.action && e.action !== f.action) return false;
  if (f.status && e.status !== f.status) return false;

  const d = parseSyncLogDetails(e.details);
  const input = d?.input;
  if (f.trigger) {
    const tr = d?.trigger ?? "manual";
    if (tr !== f.trigger) return false;
  }

  if (f.recordQ.trim()) {
    const q = f.recordQ.trim().toLowerCase();
    const inIds = e.recordIds.some((id) => id.toLowerCase().includes(q));
    const inInput = input?.recordIds?.some((id) => id.toLowerCase().includes(q));
    if (!inIds && !inInput) return false;
  }
  if (f.jobQ.trim()) {
    const q = f.jobQ.trim();
    const pj = (input?.printJobId ?? "").trim();
    if (!pj.includes(q) && pj !== q) return false;
  }
  if (f.batchQ.trim()) {
    const q = f.batchQ.trim();
    const br = (input?.batchRef ?? "").trim();
    if (!br.includes(q) && br !== q) return false;
  }

  if (f.from) {
    const t = new Date(e.startedAt).getTime();
    const fromT = new Date(f.from).setHours(0, 0, 0, 0);
    if (t < fromT) return false;
  }
  if (f.to) {
    const t = new Date(e.startedAt).getTime();
    const toT = new Date(f.to).setHours(23, 59, 59, 999);
    if (t > toT) return false;
  }

  return true;
}

export function ItemsMarkingSyncConsolePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [jobInput, setJobInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [idsText, setIdsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<MarkingExternalSyncRunResult | null>(null);

  const [filterProvider, setFilterProvider] = useState("");
  const [filterAction, setFilterAction] = useState<"" | MarkingSyncLogAction>("");
  const [filterStatus, setFilterStatus] = useState<"" | MarkingSyncLogStatus>("");
  const [filterRecord, setFilterRecord] = useState("");
  const [filterJob, setFilterJob] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterTrigger, setFilterTrigger] = useState<"" | MarkingSyncLogTrigger>("");
  const [filterUnresolvedFromLastRun, setFilterUnresolvedFromLastRun] = useState(false);

  useEffect(() => {
    const record = searchParams.get("record") ?? "";
    const job = searchParams.get("job") ?? "";
    const batchRef = searchParams.get("batchRef") ?? "";
    const records = searchParams.get("records") ?? "";
    if (record) setFilterRecord(record);
    if (job) {
      setJobInput(job);
      setFilterJob(job);
    }
    if (batchRef) {
      setBatchInput(batchRef);
      setFilterBatch(batchRef);
    }
    if (records) setIdsText(records);
    else if (record && !records) setIdsText(record);
  }, [searchParams]);

  const logs = useMemo(() => {
    void revision;
    return markingSyncLogRepository.listRecent(400);
  }, [revision]);

  const integrationEffective = useMemo(() => {
    void revision;
    const x = getMarkingExternalIntegrationInfo();
    if (x.effectiveLabel === "disabled") return "disabled" as const;
    return x.effectiveLabel === "mock" ? ("mock" as const) : ("real" as const);
  }, [revision]);

  const lastRunUnresolvedIds = useMemo(() => {
    if (!lastRun || lastRun.action !== "FETCH_STATUS") return [];
    const ids = lastRun.perRecord.filter((p) => p.ok).map((p) => p.recordId);
    if (ids.length === 0) return [];
    const all = markingRecordRepository.list();
    const voidByItem = buildVoidCountsByItemId(all);
    const voidByBatch = buildVoidCountsByBatchRef(all);
    const unresolved: string[] = [];
    for (const id of ids) {
      const r = markingRecordRepository.getById(id);
      if (!r) continue;
      const ctx = buildReconciliationContext(r, Date.now(), integrationEffective, getMarkingRecordLastPrintAudit(r.id), voidByItem, voidByBatch);
      const a = analyzeMarkingReconciliation(r, ctx);
      if (a.needsAttention) unresolved.push(id);
    }
    return unresolved;
  }, [lastRun, integrationEffective, revision]);

  const unresolvedSet = useMemo(() => new Set(lastRunUnresolvedIds), [lastRunUnresolvedIds]);

  const filteredLogs = useMemo(() => {
    return logs.filter((e) =>
      logMatchesFilters(e, {
        providerQ: filterProvider,
        action: filterAction,
        status: filterStatus,
        recordQ: filterRecord,
        jobQ: filterJob,
        batchQ: filterBatch,
        from: filterFrom,
        to: filterTo,
        trigger: filterTrigger,
        unresolvedRecordIds: filterUnresolvedFromLastRun && unresolvedSet.size > 0 ? unresolvedSet : null,
      }),
    );
  }, [
    logs,
    filterProvider,
    filterAction,
    filterStatus,
    filterRecord,
    filterJob,
    filterBatch,
    filterFrom,
    filterTo,
    filterTrigger,
    filterUnresolvedFromLastRun,
    unresolvedSet,
  ]);

  const scheduler = useMemo(() => {
    void revision;
    return getMarkingAutoSyncSchedulerState();
  }, [revision]);

  const integration = useMemo(() => {
    void revision;
    return getMarkingExternalIntegrationInfo();
  }, [revision]);

  const pushUrlParams = useCallback(() => {
    const next = new URLSearchParams();
    const ids = parseIds(idsText);
    if (ids.length === 1) next.set("record", ids[0]);
    else if (ids.length > 1) next.set("records", ids.join(","));
    if (jobInput.trim()) next.set("job", jobInput.trim());
    if (batchInput.trim()) next.set("batchRef", batchInput.trim());
    setSearchParams(next, { replace: true });
  }, [idsText, jobInput, batchInput, setSearchParams]);

  const run = useCallback(
    async (fn: () => Promise<MarkingExternalSyncRunResult>) => {
      setBusy(true);
      try {
        const r = await fn();
        setLastRun(r);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const actionOptions = useMemo(
    () => [{ value: "", label: t("master.markingSyncConsole.filterActionAll") }, ...ACTIONS.map((a) => ({ value: a, label: a }))],
    [t],
  );
  const statusOptions = useMemo(
    () => [{ value: "", label: t("master.markingSyncConsole.filterStatusAll") }, ...STATUSES.map((s) => ({ value: s, label: s }))],
    [t],
  );
  const triggerFilterOptions = useMemo(
    () => [
      { value: "", label: t("master.markingSyncConsole.filterTriggerAll") },
      { value: "manual", label: t("master.markingSyncConsole.filterTriggerManual") },
      { value: "auto", label: t("master.markingSyncConsole.filterTriggerAuto") },
    ],
    [t],
  );

  return (
    <div className="doc-page mx-auto max-w-[1600px] space-y-3 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <Link to="/items" className="text-primary hover:underline">
              {t("master.item.listBreadcrumb")}
            </Link>
          </p>
          <h1 className="text-base font-semibold tracking-tight">{t("master.markingSyncConsole.title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{t("master.markingSyncConsole.intro")}</p>
          <MarkingIntegrationModeBanner />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <Link className="text-primary hover:underline" to="/settings/marking-provider">
              {t("master.markingSyncConsole.linkProviderSettings")}
            </Link>
            <Link className="text-primary hover:underline" to="/items/marking-reconciliation">
              {t("master.markingSyncConsole.linkReconciliation")}
            </Link>
            <Link className="text-primary hover:underline" to="/items/marking-traceability">
              {t("master.markingSyncConsole.linkTraceability")}
            </Link>
          </p>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {t("master.markingSyncConsole.activeAdapter")}:{" "}
          <span className="font-mono text-foreground/90">{integration.adapterId}</span> · {t(`master.markingProvider.effective.${integration.effectiveLabel}`)}
        </div>
      </div>

      <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-[11px] space-y-1" role="region">
        <p className="font-medium">{t("master.markingSyncConsole.schedulerTitle")}</p>
        <p>
          {t("master.markingSyncConsole.schedulerInterval")}:{" "}
          <span className="font-mono">{scheduler.isRunning ? t("master.markingSyncConsole.yes") : t("master.markingSyncConsole.no")}</span> ·{" "}
          {t("master.markingSyncConsole.schedulerAutoEnabled")}:{" "}
          <span className="font-mono">{scheduler.isEnabled ? t("master.markingSyncConsole.yes") : t("master.markingSyncConsole.no")}</span> ·{" "}
          {t("master.markingSyncConsole.schedulerInFlight")}:{" "}
          <span className="font-mono">{scheduler.inFlight ? t("master.markingSyncConsole.yes") : t("master.markingSyncConsole.no")}</span>
        </p>
        <p>
          {t("master.markingSyncConsole.schedulerLast")}: <span className="font-mono">{scheduler.lastStatus}</span>
          {scheduler.lastMessage ? (
            <>
              {" "}
              — {scheduler.lastMessage}
            </>
          ) : null}
        </p>
        <p>
          {t("master.markingSyncConsole.schedulerNext")}:{" "}
          {scheduler.nextPlannedRunAt
            ? new Date(scheduler.nextPlannedRunAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
            : "—"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await runMarkingAutoSyncNow();
              if ("blocked" in r) {
                return {
                  logId: "",
                  status: "FAILED" as const,
                  action: "FETCH_STATUS" as const,
                  provider: integration.adapterId,
                  isMock: integration.isMock,
                  perRecord: [],
                  message: r.message,
                  syncTrigger: "auto",
                };
              }
              return r;
            })
          }
        >
          {t("master.markingSyncConsole.runAutoSyncNow")}
        </Button>
      </div>

      {lastRun ? (
        <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2 text-xs" role="status">
          <p className="font-medium">
            {t("master.markingSyncConsole.lastRun")}
            {lastRun.logId ? ` #${lastRun.logId}` : ""} · {lastRun.status} · {lastRun.action}
            {lastRun.syncTrigger ? (
              <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {lastRun.syncTrigger === "auto" ? t("master.markingSyncConsole.badgeAuto") : t("master.markingSyncConsole.badgeManual")}
              </span>
            ) : null}
          </p>
          {lastRun.message ? <p className="mt-1 text-muted-foreground">{lastRun.message}</p> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("master.markingSyncConsole.lastRunOk", { ok: lastRun.perRecord.filter((p) => p.ok).length, total: lastRun.perRecord.length })}
          </p>
          {lastRun.action === "FETCH_STATUS" && lastRunUnresolvedIds.length > 0 ? (
            <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-100">
              <p>{t("master.markingSyncConsole.unresolvedAfterSync", { n: lastRunUnresolvedIds.length })}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{t("master.markingSyncConsole.unresolvedAfterSyncHint")}</p>
              <Link
                className="mt-1 inline-block text-primary hover:underline"
                to={`/items/marking-reconciliation?records=${encodeURIComponent(lastRunUnresolvedIds.join(","))}`}
              >
                {t("master.markingSyncConsole.openReconciliationUnresolved")}
              </Link>
            </div>
          ) : lastRun.action === "FETCH_STATUS" && lastRun.status === "SUCCESS" && lastRunUnresolvedIds.length === 0 && lastRun.perRecord.some((p) => p.ok) ? (
            <p className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-200">{t("master.markingSyncConsole.reconciliationCleanAfterSync")}</p>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-md border border-border/80 bg-card/40 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingSyncConsole.actionsTitle")}</p>
        <div className="grid gap-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingSyncConsole.fieldIds")}</Label>
            <Textarea value={idsText} onChange={(e) => setIdsText(e.target.value)} rows={3} className="font-mono text-[11px]" placeholder="id1, id2" />
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                className="h-7 text-[10px]"
                disabled={busy}
                onClick={() => void run(() => syncMarkingRecords(parseIds(idsText), "FETCH_STATUS"))}
              >
                {t("master.markingSyncConsole.btnSyncIds")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[10px]"
                disabled={busy}
                onClick={() => void run(() => confirmMarkingRecordsUsedExternally(parseIds(idsText)))}
              >
                {t("master.markingSyncConsole.btnConfirm")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={busy}
                onClick={() => void run(() => voidMarkingRecordsExternally(parseIds(idsText)))}
              >
                {t("master.markingSyncConsole.btnVoid")}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingSyncConsole.fieldJob")}</Label>
            <Input value={jobInput} onChange={(e) => setJobInput(e.target.value)} className="h-8 font-mono text-xs" />
            <Button type="button" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => void run(() => syncByPrintJob(jobInput))}>
              {t("master.markingSyncConsole.btnSyncJob")}
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingSyncConsole.fieldBatch")}</Label>
            <Input value={batchInput} onChange={(e) => setBatchInput(e.target.value)} className="h-8 font-mono text-xs" />
            <Button type="button" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => void run(() => syncByBatchRef(batchInput))}>
              {t("master.markingSyncConsole.btnSyncBatch")}
            </Button>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={pushUrlParams}>
          {t("master.markingSyncConsole.saveParamsToUrl")}
        </Button>
      </section>

      <section className="rounded-md border border-border/80 bg-card/40 p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingSyncConsole.logTitle")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterProvider")}</Label>
            <Input value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="h-8 font-mono text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterAction")}</Label>
            <SelectField
              value={filterAction}
              onChange={(v) => setFilterAction(v as "" | MarkingSyncLogAction)}
              options={actionOptions}
              placeholder=""
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterStatus")}</Label>
            <SelectField
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as "" | MarkingSyncLogStatus)}
              options={statusOptions}
              placeholder=""
              className="h-8 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterRecord")}</Label>
            <Input value={filterRecord} onChange={(e) => setFilterRecord(e.target.value)} className="h-8 font-mono text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterJob")}</Label>
            <Input value={filterJob} onChange={(e) => setFilterJob(e.target.value)} className="h-8 font-mono text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterBatch")}</Label>
            <Input value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} className="h-8 font-mono text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterFrom")}</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterTo")}</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 text-[11px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("master.markingSyncConsole.filterTrigger")}</Label>
            <SelectField
              value={filterTrigger}
              onChange={(v) => setFilterTrigger(v as "" | MarkingSyncLogTrigger)}
              options={triggerFilterOptions}
              placeholder=""
              className="h-8 text-[11px]"
            />
          </div>
          <div className="flex items-end pb-1 sm:col-span-2">
            <label className="flex items-center gap-2 text-[11px]">
              <Checkbox
                id="filter-unresolved"
                checked={filterUnresolvedFromLastRun}
                onCheckedChange={(v) => setFilterUnresolvedFromLastRun(v === true)}
                disabled={unresolvedSet.size === 0}
              />
              <span>{t("master.markingSyncConsole.filterUnresolvedFromLastRun")}</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-border/60">
          <table className="w-full min-w-[960px] border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colId")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colProvider")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colMock")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colAction")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colStatus")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colCounts")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colStarted")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colMessage")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colExtRef")}</th>
                <th className="px-2 py-1.5 font-medium">{t("master.markingSyncConsole.colRerun")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-3 text-muted-foreground">
                    {t("master.markingSyncConsole.logEmpty")}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((e) => {
                  const d = parseSyncLogDetails(e.details);
                  const pr = d?.perRecord ?? [];
                  const okN = pr.filter((p) => p.ok).length;
                  const trig = d?.trigger ?? "manual";
                  return (
                    <tr key={e.id} className="border-b border-border/50 align-top">
                      <td className="px-2 py-1 font-mono">{e.id}</td>
                      <td className="px-2 py-1 font-mono">{e.provider}</td>
                      <td className="px-2 py-1">{d?.isMock ? t("master.markingSyncConsole.yes") : t("master.markingSyncConsole.no")}</td>
                      <td className="px-2 py-1 font-mono">
                        {e.action}
                        {e.action === "FETCH_STATUS" ? (
                          <span className="ml-1 text-[9px] text-muted-foreground">
                            ({trig === "auto" ? t("master.markingSyncConsole.badgeAuto") : t("master.markingSyncConsole.badgeManual")})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1">{e.status}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {pr.length ? `${okN}/${pr.length}` : "—"}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">
                        {new Date(e.startedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="max-w-[220px] px-2 py-1 break-words">{e.message ?? "—"}</td>
                      <td className="max-w-[140px] px-2 py-1 break-all font-mono text-[9px]">{e.externalReference ?? "—"}</td>
                      <td className="px-2 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-[10px]"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const r = await rerunMarkingSyncLogEntry(e.id);
                              if (!r) {
                                return {
                                  logId: "",
                                  status: "FAILED" as const,
                                  action: e.action,
                                  provider: integration.adapterId,
                                  isMock: integration.isMock,
                                  perRecord: [],
                                  message: "rerun_not_supported",
                                };
                              }
                              return r;
                            })
                          }
                        >
                          {t("master.markingSyncConsole.rerun")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
