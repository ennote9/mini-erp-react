import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { printJobRepository } from "@/modules/labels/printJobRepository";
import type { Item } from "../model";
import type { ItemMarkingRecord, ItemMarkingRecordSource, ItemMarkingRecordStatus } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditSource } from "../model/itemMarkingRecordAudit";
import {
  buildTraceabilityRows,
  buildVoidCountsByBatchRef,
  buildVoidCountsByItemId,
  computeTraceabilityMetrics,
  countMarkingRecordsByStatus,
  countTransitionsByPrintSource,
  listAllMarkingRecordsForReporting,
  type MarkingProblemKind,
  type TraceabilityEnrichedRow,
} from "../lib/markingTraceabilityReporting";
import { listMarkingRecordAuditByRecordId, listMarkingRecordIdsByPrintJobId } from "../markingRecordService";
import { getMarkingExternalIntegrationInfo, syncByBatchRef, syncByPrintJob, syncMarkingRecords } from "../markingExternalSyncService";
import { MarkingIntegrationModeBanner } from "../components/MarkingIntegrationModeBanner";
import {
  analyzeMarkingReconciliation,
  buildReconciliationContext,
  summarizeReconciliationAnalyses,
  type MarkingMismatchKind,
  type MarkingReconciliationAnalysis,
} from "../lib/markingExternalReconciliation";
import { getSyncProblemKind } from "../lib/markingSyncMismatch";
import { itemRepository } from "../repository";
import { ItemsSubnav } from "../components/ItemsSubnav";

const KINDS: Array<{ value: "" | ItemMarkingRecord["kind"]; labelKey: string }> = [
  { value: "", labelKey: "master.markingTraceability.filterKindAll" },
  { value: "MARKING", labelKey: "master.item.markingPool.kind.MARKING" },
  { value: "KIZ", labelKey: "master.item.markingPool.kind.KIZ" },
  { value: "DATAMATRIX", labelKey: "master.item.markingPool.kind.DATAMATRIX" },
  { value: "GS1_DATAMATRIX", labelKey: "master.item.markingPool.kind.GS1_DATAMATRIX" },
];

const STATUS_OPTS: Array<{ value: "" | ItemMarkingRecordStatus; labelKey: string }> = [
  { value: "", labelKey: "master.markingTraceability.filterStatusAll" },
  { value: "AVAILABLE", labelKey: "master.item.markingPool.status.AVAILABLE" },
  { value: "RESERVED", labelKey: "master.item.markingPool.status.RESERVED" },
  { value: "PRINTED", labelKey: "master.item.markingPool.status.PRINTED" },
  { value: "USED", labelKey: "master.item.markingPool.status.USED" },
  { value: "VOID", labelKey: "master.item.markingPool.status.VOID" },
];

const RECORD_SOURCES: Array<{ value: "" | ItemMarkingRecordSource; labelKey: string }> = [
  { value: "", labelKey: "master.markingTraceability.filterRecordSourceAll" },
  { value: "MANUAL", labelKey: "master.markingTraceability.recordSource.MANUAL" },
  { value: "IMPORT", labelKey: "master.markingTraceability.recordSource.IMPORT" },
  { value: "GENERATED", labelKey: "master.markingTraceability.recordSource.GENERATED" },
  { value: "OTHER", labelKey: "master.markingTraceability.recordSource.OTHER" },
];

const AUDIT_SOURCES: { value: "" | ItemMarkingRecordAuditSource; labelKey: string }[] = [
  { value: "", labelKey: "master.markingTraceability.filterAuditSourceAll" },
  { value: "manual", labelKey: "master.item.markingPool.auditSource.manual" },
  { value: "print_workspace", labelKey: "master.item.markingPool.auditSource.print_workspace" },
  { value: "print_station", labelKey: "master.item.markingPool.auditSource.print_station" },
  { value: "print_batch", labelKey: "master.item.markingPool.auditSource.print_batch" },
  { value: "import", labelKey: "master.item.markingPool.auditSource.import" },
  { value: "void", labelKey: "master.item.markingPool.auditSource.void" },
  { value: "mark_used", labelKey: "master.item.markingPool.auditSource.mark_used" },
  { value: "release", labelKey: "master.item.markingPool.auditSource.release" },
  { value: "reconciliation", labelKey: "master.item.markingPool.auditSource.reconciliation" },
  { value: "system", labelKey: "master.item.markingPool.auditSource.system" },
];

function auditSourceLabel(t: (k: string) => string, source: ItemMarkingRecordAuditSource | undefined): string {
  if (!source) return "—";
  const key = `master.item.markingPool.auditSource.${source}` as const;
  const tr = t(key);
  return tr === key ? source : tr;
}

function problemLabel(t: (k: string) => string, k: MarkingProblemKind): string {
  const key = `master.markingTraceability.problem.${k}` as const;
  const tr = t(key);
  return tr === key ? k : tr;
}

const MISMATCH_KIND_TRACE_FILTERS: { value: "" | MarkingMismatchKind; labelKey: string }[] = [
  { value: "", labelKey: "master.markingTraceability.filterMismatchKindAll" },
  { value: "never_synced", labelKey: "master.markingReconciliation.mismatchKind.never_synced" },
  { value: "sync_failed", labelKey: "master.markingReconciliation.mismatchKind.sync_failed" },
  { value: "external_missing", labelKey: "master.markingReconciliation.mismatchKind.external_missing" },
  { value: "external_unknown", labelKey: "master.markingReconciliation.mismatchKind.external_unknown" },
  { value: "status_mismatch", labelKey: "master.markingReconciliation.mismatchKind.status_mismatch" },
  { value: "printed_not_confirmed_externally", labelKey: "master.markingReconciliation.mismatchKind.printed_not_confirmed_externally" },
  { value: "used_internally_but_not_confirmed_externally", labelKey: "master.markingReconciliation.mismatchKind.used_internally_but_not_confirmed_externally" },
  { value: "void_internally_but_active_externally", labelKey: "master.markingReconciliation.mismatchKind.void_internally_but_active_externally" },
  { value: "reserved_too_long", labelKey: "master.markingReconciliation.mismatchKind.reserved_too_long" },
  { value: "printed_too_long_without_used", labelKey: "master.markingReconciliation.mismatchKind.printed_too_long_without_used" },
  { value: "provider_conflict", labelKey: "master.markingReconciliation.mismatchKind.provider_conflict" },
  { value: "stale_external_snapshot", labelKey: "master.markingReconciliation.mismatchKind.stale_external_snapshot" },
  { value: "provider_unavailable", labelKey: "master.markingReconciliation.mismatchKind.provider_unavailable" },
];

type TraceabilityRow = TraceabilityEnrichedRow & { analysis: MarkingReconciliationAnalysis };

export function ItemsMarkingTraceabilityPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [batchRefFilter, setBatchRefFilter] = useState(() => searchParams.get("batchRef") ?? "");
  const [printJobFilter, setPrintJobFilter] = useState(() => searchParams.get("job") ?? "");
  const [itemFilter, setItemFilter] = useState(() => searchParams.get("item") ?? "");
  const [auditSource, setAuditSource] = useState<"" | ItemMarkingRecordAuditSource>(
    () => (searchParams.get("src") as ItemMarkingRecordAuditSource | null) ?? "",
  );
  const [recordSource, setRecordSource] = useState<"" | ItemMarkingRecordSource>(() => {
    const x = searchParams.get("rsrc");
    if (x && ["MANUAL", "IMPORT", "GENERATED", "OTHER"].includes(x)) return x as ItemMarkingRecordSource;
    return "";
  });
  const [kindFilter, setKindFilter] = useState<"" | ItemMarkingRecord["kind"]>(() => {
    const k = searchParams.get("kind");
    if (k && ["MARKING", "KIZ", "DATAMATRIX", "GS1_DATAMATRIX"].includes(k)) return k as ItemMarkingRecord["kind"];
    return "";
  });
  const [statusFilter, setStatusFilter] = useState<"" | ItemMarkingRecordStatus>(() => {
    const s = searchParams.get("status");
    if (s && ["AVAILABLE", "RESERVED", "PRINTED", "USED", "VOID"].includes(s)) return s as ItemMarkingRecordStatus;
    return "";
  });
  const [problemOnly, setProblemOnly] = useState(() => searchParams.get("problem") === "1");
  const [extMismatchOnly, setExtMismatchOnly] = useState(() => searchParams.get("extM") === "1");
  const [extFailedOnly, setExtFailedOnly] = useState(() => searchParams.get("extF") === "1");
  const [extNeverOnly, setExtNeverOnly] = useState(() => searchParams.get("extN") === "1");
  const [severityFilter, setSeverityFilter] = useState<"" | "info" | "warning" | "error">("");
  const [mismatchKindFilter, setMismatchKindFilter] = useState<"" | MarkingMismatchKind>("");
  const [updatedFrom, setUpdatedFrom] = useState(() => searchParams.get("from") ?? "");
  const [updatedTo, setUpdatedTo] = useState(() => searchParams.get("to") ?? "");

  const [detailId, setDetailId] = useState<string | null>(() => searchParams.get("record"));
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const items = useMemo(() => {
    void revision;
    return itemRepository.list();
  }, [revision]);

  const itemById = useMemo(() => {
    const m = new Map<string, Item>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const allRecords = useMemo(() => {
    void revision;
    return listAllMarkingRecordsForReporting();
  }, [revision]);

  const voidByItem = useMemo(() => buildVoidCountsByItemId(allRecords), [allRecords]);
  const voidByBatchRef = useMemo(() => buildVoidCountsByBatchRef(allRecords), [allRecords]);

  const jobIdsForPrintFilter = useMemo(() => {
    if (!printJobFilter.trim()) return null;
    return new Set(listMarkingRecordIdsByPrintJobId(printJobFilter.trim()));
  }, [printJobFilter, revision]);

  const traceRowsAll = useMemo(
    () => buildTraceabilityRows(allRecords, Date.now(), voidByItem, voidByBatchRef),
    [allRecords, voidByItem, voidByBatchRef, revision],
  );

  const integrationEffective = useMemo(() => {
    void revision;
    const x = getMarkingExternalIntegrationInfo();
    if (x.effectiveLabel === "disabled") return "disabled" as const;
    return x.effectiveLabel === "mock" ? ("mock" as const) : ("real" as const);
  }, [revision]);

  const traceRowsWithAnalysis = useMemo((): TraceabilityRow[] => {
    return traceRowsAll.map((row) => {
      const ctx = buildReconciliationContext(
        row.record,
        Date.now(),
        integrationEffective,
        row.lastPrintAudit,
        voidByItem,
        voidByBatchRef,
      );
      return { ...row, analysis: analyzeMarkingReconciliation(row.record, ctx) };
    });
  }, [traceRowsAll, integrationEffective, voidByItem, voidByBatchRef]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const batchQ = batchRefFilter.trim().toLowerCase();

    return traceRowsWithAnalysis.filter((row) => {
      const { record: r, lastPrintAudit, problems, analysis } = row;
      const item = itemById.get(r.itemId);

      if (kindFilter && r.kind !== kindFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (itemFilter && r.itemId !== itemFilter) return false;
      if (jobIdsForPrintFilter && !jobIdsForPrintFilter.has(r.id)) return false;
      if (batchQ && !(r.batchRef ?? "").toLowerCase().includes(batchQ)) return false;
      if (auditSource && lastPrintAudit?.source !== auditSource) return false;
      if (recordSource) {
        const rs = r.source ?? "OTHER";
        if (rs !== recordSource) return false;
      }
      if (problemOnly && !problems.hasProblem && !analysis.needsAttention) return false;

      if (severityFilter && analysis.severity !== severityFilter) return false;
      if (mismatchKindFilter && analysis.kind !== mismatchKindFilter) return false;

      const sp = getSyncProblemKind(r);
      if (extMismatchOnly && sp !== "mismatch") return false;
      if (extFailedOnly && sp !== "sync_failed") return false;
      if (extNeverOnly && sp !== "never_synced") return false;

      if (updatedFrom.trim()) {
        const fromT = new Date(`${updatedFrom.trim()}T00:00:00`).getTime();
        const u = Date.parse(r.updatedAt);
        if (Number.isFinite(fromT) && Number.isFinite(u) && u < fromT) return false;
      }
      if (updatedTo.trim()) {
        const toT = new Date(`${updatedTo.trim()}T23:59:59.999`).getTime();
        const u = Date.parse(r.updatedAt);
        if (Number.isFinite(toT) && Number.isFinite(u) && u > toT) return false;
      }

      if (q) {
        const code = item?.code?.toLowerCase() ?? "";
        const name = item?.name?.toLowerCase() ?? "";
        const payload = r.payload.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !payload.includes(q)) return false;
      }
      return true;
    });
  }, [
    traceRowsWithAnalysis,
    itemById,
    kindFilter,
    statusFilter,
    itemFilter,
    jobIdsForPrintFilter,
    batchRefFilter,
    auditSource,
    recordSource,
    problemOnly,
    extMismatchOnly,
    extFailedOnly,
    extNeverOnly,
    severityFilter,
    mismatchKindFilter,
    updatedFrom,
    updatedTo,
    search,
  ]);

  const filteredRecords = useMemo(() => filteredRows.map((x) => x.record), [filteredRows]);

  const runSyncSlice = useCallback(async () => {
    const ids = filteredRecords.map((r) => r.id);
    if (ids.length === 0) return;
    setSyncBusy(true);
    setSyncFeedback(null);
    try {
      const r = await syncMarkingRecords(ids, "FETCH_STATUS");
      setSyncFeedback(
        t("master.markingExternalSync.traceFeedback", {
          status: r.status,
          logId: r.logId,
          n: r.perRecord.filter((x) => x.ok).length,
          total: r.perRecord.length,
        }),
      );
    } catch (e) {
      setSyncFeedback(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncBusy(false);
    }
  }, [filteredRecords, t]);

  const runSyncJob = useCallback(async () => {
    const j = printJobFilter.trim();
    if (!j) return;
    setSyncBusy(true);
    setSyncFeedback(null);
    try {
      const r = await syncByPrintJob(j);
      setSyncFeedback(
        t("master.markingExternalSync.traceFeedback", {
          status: r.status,
          logId: r.logId,
          n: r.perRecord.filter((x) => x.ok).length,
          total: r.perRecord.length,
        }),
      );
    } catch (e) {
      setSyncFeedback(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncBusy(false);
    }
  }, [printJobFilter, t]);

  const runSyncBatch = useCallback(async () => {
    const b = batchRefFilter.trim();
    if (!b) return;
    setSyncBusy(true);
    setSyncFeedback(null);
    try {
      const r = await syncByBatchRef(b);
      setSyncFeedback(
        t("master.markingExternalSync.traceFeedback", {
          status: r.status,
          logId: r.logId,
          n: r.perRecord.filter((x) => x.ok).length,
          total: r.perRecord.length,
        }),
      );
    } catch (e) {
      setSyncFeedback(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncBusy(false);
    }
  }, [batchRefFilter, t]);

  const runSyncOne = useCallback(async () => {
    if (!detailId) return;
    setSyncBusy(true);
    setSyncFeedback(null);
    try {
      const r = await syncMarkingRecords([detailId], "FETCH_STATUS");
      setSyncFeedback(
        t("master.markingExternalSync.traceFeedback", {
          status: r.status,
          logId: r.logId,
          n: r.perRecord.filter((x) => x.ok).length,
          total: r.perRecord.length,
        }),
      );
    } catch (e) {
      setSyncFeedback(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncBusy(false);
    }
  }, [detailId, t]);

  const statusCounts = useMemo(() => countMarkingRecordsByStatus(filteredRecords), [filteredRecords]);

  const auditRecordIdSet = useMemo(() => new Set(filteredRecords.map((r) => r.id)), [filteredRecords]);

  const metrics = useMemo(
    () => computeTraceabilityMetrics(filteredRecords, Date.now(), { auditRecordIds: auditRecordIdSet }),
    [filteredRecords, auditRecordIdSet, revision],
  );

  const transitionsBySource = useMemo(() => countTransitionsByPrintSource(), [revision]);

  const detailRow = useMemo(() => {
    if (!detailId) return null;
    return filteredRows.find((x) => x.record.id === detailId) ?? traceRowsWithAnalysis.find((x) => x.record.id === detailId) ?? null;
  }, [detailId, filteredRows, traceRowsWithAnalysis]);

  const reconciliationSummary = useMemo(
    () =>
      summarizeReconciliationAnalyses(
        filteredRows.map((row) => ({ recordId: row.record.id, analysis: row.analysis })),
      ),
    [filteredRows],
  );

  const detailAudit = useMemo(() => {
    void revision;
    if (!detailId) return [];
    return listMarkingRecordAuditByRecordId(detailId, 64);
  }, [detailId, revision]);

  const jobSummary = useMemo(() => {
    if (!detailRow?.lastPrintAudit?.printJobId) return null;
    return printJobRepository.getById(detailRow.lastPrintAudit.printJobId);
  }, [detailRow]);

  useEffect(() => {
    if (searchParams.has("item")) setItemFilter(searchParams.get("item") ?? "");
    if (searchParams.has("job")) setPrintJobFilter(searchParams.get("job") ?? "");
    if (searchParams.has("batchRef")) setBatchRefFilter(searchParams.get("batchRef") ?? "");
    if (searchParams.has("src")) {
      const src = searchParams.get("src");
      const ok = AUDIT_SOURCES.some((o) => o.value && o.value === src);
      setAuditSource(ok ? (src as ItemMarkingRecordAuditSource) : "");
    }
    if (searchParams.has("rsrc")) {
      const x = searchParams.get("rsrc");
      if (x && ["MANUAL", "IMPORT", "GENERATED", "OTHER"].includes(x)) setRecordSource(x as ItemMarkingRecordSource);
      else setRecordSource("");
    }
    if (searchParams.has("kind")) {
      const kind = searchParams.get("kind");
      if (kind && ["MARKING", "KIZ", "DATAMATRIX", "GS1_DATAMATRIX"].includes(kind)) setKindFilter(kind as ItemMarkingRecord["kind"]);
      else setKindFilter("");
    }
    if (searchParams.has("status")) {
      const s = searchParams.get("status");
      if (s && ["AVAILABLE", "RESERVED", "PRINTED", "USED", "VOID"].includes(s)) setStatusFilter(s as ItemMarkingRecordStatus);
      else setStatusFilter("");
    }
    if (searchParams.has("problem")) setProblemOnly(searchParams.get("problem") === "1");
    if (searchParams.has("extM")) setExtMismatchOnly(searchParams.get("extM") === "1");
    if (searchParams.has("extF")) setExtFailedOnly(searchParams.get("extF") === "1");
    if (searchParams.has("extN")) setExtNeverOnly(searchParams.get("extN") === "1");
    if (searchParams.has("from")) setUpdatedFrom(searchParams.get("from") ?? "");
    if (searchParams.has("to")) setUpdatedTo(searchParams.get("to") ?? "");
    if (searchParams.has("record")) setDetailId(searchParams.get("record"));
    if (searchParams.has("q")) setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const syncParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (itemFilter) next.set("item", itemFilter);
    else next.delete("item");
    if (printJobFilter.trim()) next.set("job", printJobFilter.trim());
    else next.delete("job");
    if (batchRefFilter.trim()) next.set("batchRef", batchRefFilter.trim());
    else next.delete("batchRef");
    if (auditSource) next.set("src", auditSource);
    else next.delete("src");
    if (recordSource) next.set("rsrc", recordSource);
    else next.delete("rsrc");
    if (kindFilter) next.set("kind", kindFilter);
    else next.delete("kind");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (problemOnly) next.set("problem", "1");
    else next.delete("problem");
    if (extMismatchOnly) next.set("extM", "1");
    else next.delete("extM");
    if (extFailedOnly) next.set("extF", "1");
    else next.delete("extF");
    if (extNeverOnly) next.set("extN", "1");
    else next.delete("extN");
    if (updatedFrom.trim()) next.set("from", updatedFrom.trim());
    else next.delete("from");
    if (updatedTo.trim()) next.set("to", updatedTo.trim());
    else next.delete("to");
    if (detailId) next.set("record", detailId);
    else next.delete("record");
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    search,
    itemFilter,
    printJobFilter,
    batchRefFilter,
    auditSource,
    recordSource,
    kindFilter,
    statusFilter,
    problemOnly,
    extMismatchOnly,
    extFailedOnly,
    extNeverOnly,
    updatedFrom,
    updatedTo,
    detailId,
    setSearchParams,
  ]);

  const reconciliationHref = useMemo(() => {
    const q = new URLSearchParams();
    if (itemFilter) q.set("item", itemFilter);
    if (printJobFilter.trim()) q.set("job", printJobFilter.trim());
    if (batchRefFilter.trim()) q.set("batchRef", batchRefFilter.trim());
    if (kindFilter) q.set("kind", kindFilter);
    if (auditSource) q.set("src", auditSource);
    const s = q.toString();
    return s ? `/items/marking-reconciliation?${s}` : "/items/marking-reconciliation";
  }, [itemFilter, printJobFilter, batchRefFilter, kindFilter, auditSource]);

  const syncConsoleHref = useMemo(() => {
    const q = new URLSearchParams();
    if (printJobFilter.trim()) q.set("job", printJobFilter.trim());
    if (batchRefFilter.trim()) q.set("batchRef", batchRefFilter.trim());
    if (detailId) q.set("record", detailId);
    const s = q.toString();
    return s ? `/items/marking-sync?${s}` : "/items/marking-sync";
  }, [printJobFilter, batchRefFilter, detailId]);

  const itemOptions = useMemo(
    () => [{ value: "", label: t("master.markingTraceability.filterItemAll") }, ...items.map((it) => ({ value: it.id, label: `${it.code} · ${it.name}` }))],
    [items, t],
  );

  const selectDetail = useCallback((id: string | null) => {
    setDetailId(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("record", id);
        else next.delete("record");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return (
    <div className="doc-page mx-auto max-w-[1600px] space-y-3 p-4 md:p-5">
      <ItemsSubnav />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <Link to="/items" className="text-primary hover:underline">
              {t("master.item.listBreadcrumb")}
            </Link>
          </p>
          <h1 className="text-base font-semibold tracking-tight">{t("master.markingTraceability.title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{t("master.markingTraceability.intro")}</p>
          <MarkingIntegrationModeBanner />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <Link to={reconciliationHref} className="text-primary underline-offset-2 hover:underline">
              {t("master.markingTraceability.openReconciliation")}
            </Link>
            <Link to={syncConsoleHref} className="text-primary underline-offset-2 hover:underline">
              {t("master.markingTraceability.openSyncConsole")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => syncParams()}>
            {t("master.markingTraceability.saveFiltersToUrl")}
          </Button>
        </div>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {(["AVAILABLE", "RESERVED", "PRINTED", "USED", "VOID"] as const).map((s) => (
          <div key={s} className="rounded-md border border-border/70 bg-card/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">{t(`master.item.markingPool.status.${s}`)}</p>
            <p className="text-xl font-semibold tabular-nums">{statusCounts[s]}</p>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingTraceability.reconciliationMetricsTitle")}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {t("master.markingReconciliation.metricAttention")}: <strong className="tabular-nums">{reconciliationSummary.attentionTotal}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricCritical")}: <strong className="tabular-nums text-red-700 dark:text-red-300">{reconciliationSummary.criticalCount}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricNeverSynced")}: <strong className="tabular-nums">{reconciliationSummary.neverSynced}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricConfirmationGaps")}: <strong className="tabular-nums">{reconciliationSummary.confirmationGaps}</strong>
          </span>
        </div>
      </section>

      <section className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingTraceability.metricsTitle")}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {t("master.markingTraceability.metricTotal")}: <strong className="tabular-nums">{metrics.totalRecords}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricPrintedNotUsed")}: <strong className="tabular-nums">{metrics.printedNotUsed}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricReservedStale")}: <strong className="tabular-nums text-amber-700 dark:text-amber-300">{metrics.reservedStale}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricPrintedStale")}: <strong className="tabular-nums text-amber-700 dark:text-amber-300">{metrics.printedStale}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricVoid7d")}: <strong className="tabular-nums">{metrics.voidLast7Days}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricUsed7d")}: <strong className="tabular-nums">{metrics.usedLast7Days}</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricUsedRatio")}: <strong>{(metrics.usedRatio * 100).toFixed(1)}%</strong>
          </span>
          <span>
            {t("master.markingTraceability.metricVoidRatio")}: <strong>{(metrics.voidRatio * 100).toFixed(1)}%</strong>
          </span>
        </div>
      </section>

      <section className="rounded-md border border-dashed border-border/70 bg-card/20 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">{t("master.markingTraceability.auditSourcesTitle")}: </span>
        {Object.entries(transitionsBySource)
          .filter(([, n]) => n > 0)
          .map(([src, n]) => (
            <span key={src} className="mr-3 inline-block">
              {auditSourceLabel(t, src as ItemMarkingRecordAuditSource)}: {n}
            </span>
          ))}
      </section>

      {syncFeedback ? (
        <div role="status" className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-foreground">
          {syncFeedback}
        </div>
      ) : null}

      <section className="flex flex-wrap items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingExternalSync.syncToolbarTitle")}</span>
        <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" disabled={syncBusy || filteredRecords.length === 0} onClick={() => void runSyncSlice()}>
          {syncBusy ? t("master.markingExternalSync.syncRunning") : t("master.markingExternalSync.syncFilteredSlice")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={syncBusy || !printJobFilter.trim()}
          onClick={() => void runSyncJob()}
        >
          {t("master.markingExternalSync.syncByPrintJobFilter")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={syncBusy || !batchRefFilter.trim()}
          onClick={() => void runSyncBatch()}
        >
          {t("master.markingExternalSync.syncByBatchFilter")}
        </Button>
      </section>

      <section className="rounded-md border border-border/80 bg-card/40 p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.search")}</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
              placeholder={t("master.markingTraceability.searchPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterItem")}</Label>
            <SelectField value={itemFilter} onChange={setItemFilter} options={itemOptions} placeholder="" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterKind")}</Label>
            <SelectField
              value={kindFilter}
              onChange={(v) => setKindFilter(v as "" | ItemMarkingRecord["kind"])}
              options={KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterStatus")}</Label>
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "" | ItemMarkingRecordStatus)}
              options={STATUS_OPTS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterPrintJob")}</Label>
            <Input
              value={printJobFilter}
              onChange={(e) => setPrintJobFilter(e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder={t("master.markingTraceability.filterPrintJobPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterBatchRef")}</Label>
            <Input value={batchRefFilter} onChange={(e) => setBatchRefFilter(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterAuditSource")}</Label>
            <SelectField
              value={auditSource}
              onChange={(v) => setAuditSource(v as "" | ItemMarkingRecordAuditSource)}
              options={AUDIT_SOURCES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterRecordSource")}</Label>
            <SelectField
              value={recordSource}
              onChange={(v) => setRecordSource(v as "" | ItemMarkingRecordSource)}
              options={RECORD_SOURCES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterUpdatedFrom")}</Label>
            <Input type="date" value={updatedFrom} onChange={(e) => setUpdatedFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingTraceability.filterUpdatedTo")}</Label>
            <Input type="date" value={updatedTo} onChange={(e) => setUpdatedTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex flex-col gap-2 pb-1 sm:col-span-2 lg:col-span-4">
            <label className="flex items-center gap-2 text-[11px]">
              <Checkbox checked={problemOnly} onCheckedChange={(v) => setProblemOnly(v === true)} id="problem-only" />
              <span>{t("master.markingTraceability.problemOnly")}</span>
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-[11px]">
                <Checkbox checked={extMismatchOnly} onCheckedChange={(v) => setExtMismatchOnly(v === true)} id="ext-mismatch" />
                <span>{t("master.markingExternalSync.filterMismatch")}</span>
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <Checkbox checked={extFailedOnly} onCheckedChange={(v) => setExtFailedOnly(v === true)} id="ext-failed" />
                <span>{t("master.markingExternalSync.filterSyncFailed")}</span>
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <Checkbox checked={extNeverOnly} onCheckedChange={(v) => setExtNeverOnly(v === true)} id="ext-never" />
                <span>{t("master.markingExternalSync.filterNeverSynced")}</span>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-[11px]">{t("master.markingReconciliation.filterSeverity")}</Label>
                <SelectField
                  value={severityFilter}
                  onChange={(v) => setSeverityFilter(v as "" | "info" | "warning" | "error")}
                  options={[
                    { value: "", label: t("master.markingReconciliation.filterSeverityAll") },
                    { value: "info", label: t("master.markingReconciliation.severity.info") },
                    { value: "warning", label: t("master.markingReconciliation.severity.warning") },
                    { value: "error", label: t("master.markingReconciliation.severity.error") },
                  ]}
                  placeholder=""
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">{t("master.markingReconciliation.filterMismatchKind")}</Label>
                <SelectField
                  value={mismatchKindFilter}
                  onChange={(v) => setMismatchKindFilter(v as "" | MarkingMismatchKind)}
                  options={MISMATCH_KIND_TRACE_FILTERS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  placeholder=""
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[960px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                <th className="px-2 py-1.5">{t("master.markingTraceability.colItem")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colPayload")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colKind")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colStatus")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colRecordSource")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colBatchRef")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colUpdated")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colLastPrintJob")}</th>
                <th className="px-2 py-1.5">{t("master.markingExternalSync.colExternal")}</th>
                <th className="px-2 py-1.5">{t("master.markingExternalSync.colSyncState")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colMismatchKind")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colSeverity")}</th>
                <th className="px-2 py-1.5">{t("master.markingTraceability.colProblem")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    {t("master.markingTraceability.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const { record: r, lastPrintAudit, problems, analysis } = row;
                  const it = itemById.get(r.itemId);
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-b border-border/40 ${detailId === r.id ? "bg-muted/25" : ""}`}
                      onClick={() => selectDetail(r.id)}
                    >
                      <td className="px-2 py-1.5">
                        {it ? (
                          <Link className="font-medium text-primary hover:underline" to={`/items/${it.id}`} onClick={(e) => e.stopPropagation()}>
                            {it.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                        <div className="truncate text-[10px] text-muted-foreground" title={it?.name}>
                          {it?.name ?? r.itemId}
                        </div>
                      </td>
                      <td className="max-w-[11rem] truncate px-2 py-1.5 font-mono text-[10px]" title={r.payload}>
                        {r.payload}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{r.kind}</td>
                      <td className="px-2 py-1.5">{t(`master.item.markingPool.status.${r.status}`)}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{r.source ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{r.batchRef ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-muted-foreground">
                        {new Date(r.updatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        {lastPrintAudit?.printJobId ? (
                          <Link
                            to={`/items/marking-reconciliation?job=${encodeURIComponent(lastPrintAudit.printJobId)}`}
                            className="font-mono text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                            title={lastPrintAudit.printJobId}
                          >
                            {lastPrintAudit.printJobId.slice(0, 10)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[7rem] truncate px-2 py-1.5 font-mono text-[10px]" title={r.externalStatus ?? ""}>
                        {r.externalStatus ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                        {r.lastSyncStatus ?? "—"}
                        {r.lastSyncAt ? (
                          <div className="text-[9px] opacity-80">
                            {new Date(r.lastSyncAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-[7rem] px-2 py-1.5 text-[9px]">
                        {analysis.kind === "none" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1 py-0.5 font-medium text-violet-950 dark:text-violet-100">
                            {t(`master.markingReconciliation.mismatchKind.${analysis.kind}`)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[9px]">
                        {analysis.kind === "none" ? (
                          "—"
                        ) : (
                          <span
                            className={
                              analysis.severity === "error"
                                ? "text-red-700 dark:text-red-300"
                                : analysis.severity === "warning"
                                  ? "text-amber-800 dark:text-amber-200"
                                  : "text-sky-800 dark:text-sky-200"
                            }
                          >
                            {t(`master.markingReconciliation.severity.${analysis.severity}`)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {problems.hasProblem ? (
                          <span className="inline-flex flex-wrap gap-0.5">
                            {problems.kinds.map((k) => (
                              <span
                                key={k}
                                className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-950 dark:text-amber-100"
                              >
                                {problemLabel(t, k)}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-md border border-border/70 bg-card/30 p-3 space-y-2 text-[11px]">
          <p className="text-xs font-semibold">{t("master.markingTraceability.detailTitle")}</p>
          {!detailRow ? (
            <p className="text-muted-foreground">{t("master.markingTraceability.detailEmpty")}</p>
          ) : (
            <>
              <dl className="space-y-1">
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailItem")}</dt>
                  <dd>
                    {itemById.get(detailRow.record.itemId) ? (
                      <Link className="text-primary hover:underline" to={`/items/${detailRow.record.itemId}`}>
                        {itemById.get(detailRow.record.itemId)!.code} · {itemById.get(detailRow.record.itemId)!.name}
                      </Link>
                    ) : (
                      detailRow.record.itemId
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailPayload")}</dt>
                  <dd className="break-all font-mono text-[10px]">{detailRow.record.payload}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailStatus")}</dt>
                  <dd>{t(`master.item.markingPool.status.${detailRow.record.status}`)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailRecordSource")}</dt>
                  <dd className="font-mono">{detailRow.record.source ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailBatchRef")}</dt>
                  <dd className="font-mono">{detailRow.record.batchRef ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailSerial")}</dt>
                  <dd className="font-mono">{detailRow.record.serial ?? "—"}</dd>
                </div>
              </dl>
              <div className="rounded border border-border/60 bg-muted/20 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingExternalSync.detailExternalBlock")}</p>
                <dl className="space-y-0.5">
                  <div>
                    <dt className="text-[9px] text-muted-foreground">{t("master.markingExternalSync.detailIntegrationMode")}</dt>
                    <dd className="text-[10px]">{t(`master.markingProvider.effective.${getMarkingExternalIntegrationInfo().effectiveLabel}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-[9px] text-muted-foreground">{t("master.markingExternalSync.detailExternalStatus")}</dt>
                    <dd className="break-all font-mono text-[10px]">{detailRow.record.externalStatus ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[9px] text-muted-foreground">{t("master.markingExternalSync.detailLastSync")}</dt>
                    <dd className="text-[10px]">
                      {detailRow.record.lastSyncStatus ?? "—"}
                      {detailRow.record.lastSyncAt
                        ? ` · ${new Date(detailRow.record.lastSyncAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] text-muted-foreground">{t("master.markingExternalSync.detailMismatch")}</dt>
                    <dd className="text-[10px] space-y-1">
                      {detailRow.analysis.kind === "none" ? (
                        t("master.markingExternalSync.detailMismatchNone")
                      ) : (
                        <>
                          <div className="font-medium">{t(`master.markingReconciliation.mismatchKind.${detailRow.analysis.kind}`)}</div>
                          <div className="text-muted-foreground">{t(`master.markingReconciliation.explanation.${detailRow.analysis.explanationKey}`)}</div>
                          <div className="text-[9px]">
                            {t("master.markingReconciliation.detailNextStep")}:{" "}
                            {detailRow.analysis.recommendedActionIds[0]
                              ? t(`master.markingReconciliation.actionHint.${detailRow.analysis.recommendedActionIds[0]}`)
                              : "—"}
                          </div>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7 w-full text-[10px]"
                  disabled={syncBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runSyncOne();
                  }}
                >
                  {syncBusy ? t("master.markingExternalSync.syncRunning") : t("master.markingExternalSync.syncThisRecord")}
                </Button>
              </div>
              {detailRow.lastPrintAudit?.printJobId ? (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground">{t("master.markingTraceability.detailPrintJob")}</p>
                  <div className="font-mono text-[10px]">{detailRow.lastPrintAudit.printJobId}</div>
                  <div className="text-muted-foreground">
                    {auditSourceLabel(t, detailRow.lastPrintAudit.source)} ·{" "}
                    {new Date(detailRow.lastPrintAudit.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  {jobSummary ? (
                    <div className="text-[10px] text-muted-foreground">
                      {jobSummary.templateNameSnapshot ?? jobSummary.templateId} · {jobSummary.mode} · {jobSummary.copies}{" "}
                      {t("master.markingReconciliation.copiesSuffix")}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5">
                    <Link className="text-primary hover:underline" to={`/labels/operations`}>
                      {t("master.markingTraceability.openLabelsOperations")}
                    </Link>
                    <Link
                      className="text-violet-700 hover:underline dark:text-violet-300"
                      to={`/items/marking-reconciliation?job=${encodeURIComponent(detailRow.lastPrintAudit.printJobId)}`}
                    >
                      {t("master.markingTraceability.openReconciliationForJob")}
                    </Link>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingTraceability.detailAudit")}</p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-[10px] leading-snug">
                  {[...detailAudit].reverse().map((e) => (
                    <li key={e.id} className="border-b border-border/30 pb-0.5">
                      {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} · {e.fromStatus ?? "—"} → {e.toStatus} ·{" "}
                      {e.reason} · {auditSourceLabel(t, e.source)}
                      {e.printJobId ? ` · job ${e.printJobId.slice(0, 8)}…` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>

      <p className="text-[10px] text-muted-foreground">{t("master.markingTraceability.footerHint", { visible: filteredRows.length })}</p>
    </div>
  );
}
