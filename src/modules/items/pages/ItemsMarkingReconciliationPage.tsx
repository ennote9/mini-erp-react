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
import { printJobRepository } from "@/modules/labels/printJobRepository";
import type { Item } from "../model";
import type { ItemMarkingRecord } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditEntry, ItemMarkingRecordAuditSource } from "../model/itemMarkingRecordAudit";
import { markingRecordRepository } from "../markingRecordRepository";
import {
  getMarkingRecordLastPrintAudit,
  listMarkingRecordAuditByRecordId,
  listMarkingRecordIdsByPrintJobId,
  reconcileBatchConfirmUsed,
  reconcileBatchReleaseToAvailable,
  reconcileBatchVoid,
} from "../markingRecordService";
import {
  analyzeMarkingReconciliation,
  buildReconciliationContext,
  partitionBulkByAction,
  summarizeReconciliationAnalyses,
  type MarkingReconciliationActionId,
  type MarkingMismatchKind,
  type MarkingReconciliationAnalysis,
} from "../lib/markingExternalReconciliation";
import { buildVoidCountsByBatchRef, buildVoidCountsByItemId } from "../lib/markingTraceabilityReporting";
import {
  confirmMarkingRecordsUsedExternally,
  getMarkingExternalIntegrationInfo,
  syncMarkingRecords,
  voidMarkingRecordsExternally,
} from "../markingExternalSyncService";
import { MarkingIntegrationModeBanner } from "../components/MarkingIntegrationModeBanner";
import { itemRepository } from "../repository";
import { ItemsModuleLayout } from "../components/ItemsModuleLayout";

const ALL_STATUSES = ["PRINTED", "RESERVED", "AVAILABLE", "USED", "VOID"] as const;
type RowStatus = (typeof ALL_STATUSES)[number];

type EnrichedRow = {
  record: ItemMarkingRecord;
  item: Item | undefined;
  lastPrint: ItemMarkingRecordAuditEntry | undefined;
  analysis: MarkingReconciliationAnalysis;
};

const MISMATCH_KIND_FILTERS: { value: "" | MarkingMismatchKind; labelKey: string }[] = [
  { value: "", labelKey: "master.markingReconciliation.filterMismatchKindAll" },
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

const PRINT_SOURCES: { value: "" | ItemMarkingRecordAuditSource; labelKey: string }[] = [
  { value: "", labelKey: "master.markingReconciliation.filterSourceAll" },
  { value: "print_workspace", labelKey: "master.markingReconciliation.filterSourceWorkspace" },
  { value: "print_station", labelKey: "master.markingReconciliation.filterSourceStation" },
  { value: "print_batch", labelKey: "master.markingReconciliation.filterSourceBatch" },
];

const KINDS: Array<{ value: "" | ItemMarkingRecord["kind"]; labelKey: string }> = [
  { value: "", labelKey: "master.markingReconciliation.filterKindAll" },
  { value: "MARKING", labelKey: "master.item.markingPool.kind.MARKING" },
  { value: "KIZ", labelKey: "master.item.markingPool.kind.KIZ" },
  { value: "DATAMATRIX", labelKey: "master.item.markingPool.kind.DATAMATRIX" },
  { value: "GS1_DATAMATRIX", labelKey: "master.item.markingPool.kind.GS1_DATAMATRIX" },
];

function auditSourceLabel(t: (k: string) => string, source: ItemMarkingRecordAuditSource | undefined): string {
  if (!source) return "—";
  const key = `master.item.markingPool.auditSource.${source}` as const;
  const tr = t(key);
  return tr === key ? source : tr;
}

export function ItemsMarkingReconciliationPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [search, setSearch] = useState("");
  const [batchRefFilter, setBatchRefFilter] = useState(() => searchParams.get("batchRef") ?? "");
  const [printJobFilter, setPrintJobFilter] = useState(() => searchParams.get("job") ?? "");
  const [itemFilter, setItemFilter] = useState(() => searchParams.get("item") ?? "");
  const [printSource, setPrintSource] = useState<"" | ItemMarkingRecordAuditSource>(
    () => (searchParams.get("src") as ItemMarkingRecordAuditSource | null) ?? "",
  );
  const [kindFilter, setKindFilter] = useState<"" | ItemMarkingRecord["kind"]>(() => {
    const k = searchParams.get("kind");
    if (k && ["MARKING", "KIZ", "DATAMATRIX", "GS1_DATAMATRIX"].includes(k)) return k as ItemMarkingRecord["kind"];
    return "";
  });

  const [statusPrinted, setStatusPrinted] = useState(true);
  const [statusReserved, setStatusReserved] = useState(true);
  const [statusAvailable, setStatusAvailable] = useState(false);
  const [statusUsed, setStatusUsed] = useState(false);
  const [statusVoid, setStatusVoid] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [voidNote, setVoidNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"" | "info" | "warning" | "error">("");
  const [mismatchKindFilter, setMismatchKindFilter] = useState<"" | MarkingMismatchKind>("");
  const [pendingExternal, setPendingExternal] = useState<null | { kind: "confirm" | "void"; eligible: string[]; skipped: string[] }>(null);

  const items = useMemo(() => {
    void revision;
    return itemRepository.list();
  }, [revision]);

  const itemById = useMemo(() => {
    const m = new Map<string, Item>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const jobIdsForPrintFilter = useMemo(() => {
    if (!printJobFilter.trim()) return null;
    return new Set(listMarkingRecordIdsByPrintJobId(printJobFilter.trim()));
  }, [printJobFilter, revision]);

  const integrationEffective = useMemo(() => {
    void revision;
    const x = getMarkingExternalIntegrationInfo();
    if (x.effectiveLabel === "disabled") return "disabled" as const;
    return x.effectiveLabel === "mock" ? ("mock" as const) : ("real" as const);
  }, [revision]);

  const enrichedRows = useMemo((): EnrichedRow[] => {
    void revision;
    const records = markingRecordRepository.list();
    const voidByItem = buildVoidCountsByItemId(records);
    const voidByBatch = buildVoidCountsByBatchRef(records);
    const out: EnrichedRow[] = [];
    for (const r of records) {
      const lastPrint = getMarkingRecordLastPrintAudit(r.id);
      const ctx = buildReconciliationContext(r, Date.now(), integrationEffective, lastPrint, voidByItem, voidByBatch);
      const analysis = analyzeMarkingReconciliation(r, ctx);
      out.push({
        record: r,
        item: itemById.get(r.itemId),
        lastPrint,
        analysis,
      });
    }
    return out;
  }, [revision, itemById, integrationEffective]);

  const activeStatuses = useMemo((): Set<RowStatus> => {
    const s = new Set<RowStatus>();
    if (statusPrinted) s.add("PRINTED");
    if (statusReserved) s.add("RESERVED");
    if (statusAvailable) s.add("AVAILABLE");
    if (statusUsed) s.add("USED");
    if (statusVoid) s.add("VOID");
    return s;
  }, [statusPrinted, statusReserved, statusAvailable, statusUsed, statusVoid]);

  const recordIdFilter = useMemo(() => {
    const raw = searchParams.get("records");
    if (!raw?.trim()) return null;
    return new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [searchParams]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const batchQ = batchRefFilter.trim().toLowerCase();
    const itemQ = itemFilter.trim();

    return enrichedRows.filter((row) => {
      const { record: r, item, lastPrint, analysis } = row;
      if (recordIdFilter && !recordIdFilter.has(r.id)) return false;
      if (!activeStatuses.has(r.status as RowStatus)) return false;
      if (kindFilter && r.kind !== kindFilter) return false;
      if (itemQ && r.itemId !== itemQ) return false;
      if (jobIdsForPrintFilter && !jobIdsForPrintFilter.has(r.id)) return false;
      if (batchQ && !(r.batchRef ?? "").toLowerCase().includes(batchQ)) return false;
      if (printSource && lastPrint?.source !== printSource) return false;

      if (mismatchOnly && !analysis.needsAttention) return false;
      if (severityFilter && analysis.severity !== severityFilter) return false;
      if (mismatchKindFilter && analysis.kind !== mismatchKindFilter) return false;

      if (q) {
        const code = item?.code?.toLowerCase() ?? "";
        const name = item?.name?.toLowerCase() ?? "";
        const payload = r.payload.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !payload.includes(q)) return false;
      }
      return true;
    });
  }, [
    enrichedRows,
    activeStatuses,
    kindFilter,
    itemFilter,
    jobIdsForPrintFilter,
    batchRefFilter,
    printSource,
    search,
    mismatchOnly,
    severityFilter,
    mismatchKindFilter,
    recordIdFilter,
  ]);

  const visibleIds = useMemo(() => filteredRows.map((x) => x.record.id), [filteredRows]);

  const detailRow = useMemo(() => {
    if (!detailId) return null;
    return enrichedRows.find((x) => x.record.id === detailId) ?? null;
  }, [detailId, enrichedRows]);

  const detailAudit = useMemo(() => {
    void revision;
    if (!detailId) return [];
    return listMarkingRecordAuditByRecordId(detailId, 48);
  }, [detailId, revision]);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleIds));
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedIds = useMemo(() => [...selected].filter((id) => visibleIds.includes(id)), [selected, visibleIds]);

  const analysisByRecordId = useMemo(() => {
    const m = new Map<string, MarkingReconciliationAnalysis>();
    for (const row of enrichedRows) m.set(row.record.id, row.analysis);
    return m;
  }, [enrichedRows]);

  const summaryMetrics = useMemo(
    () =>
      summarizeReconciliationAnalyses(
        filteredRows.map((row) => ({ recordId: row.record.id, analysis: row.analysis })),
      ),
    [filteredRows],
  );

  const resolveAnalysis = useCallback(
    (rec: ItemMarkingRecord): MarkingReconciliationAnalysis =>
      analysisByRecordId.get(rec.id) ?? enrichedRows.find((x) => x.record.id === rec.id)!.analysis,
    [analysisByRecordId, enrichedRows],
  );

  const partitionSelected = useCallback(
    (action: MarkingReconciliationActionId) =>
      partitionBulkByAction(selectedIds, (id) => markingRecordRepository.getById(id), resolveAnalysis, action),
    [selectedIds, resolveAnalysis],
  );

  useEffect(() => {
    if (searchParams.has("item")) setItemFilter(searchParams.get("item") ?? "");
    if (searchParams.has("job")) setPrintJobFilter(searchParams.get("job") ?? "");
    if (searchParams.has("batchRef")) setBatchRefFilter(searchParams.get("batchRef") ?? "");
    if (searchParams.has("src")) {
      const src = searchParams.get("src");
      if (src && ["print_workspace", "print_station", "print_batch"].includes(src)) setPrintSource(src as ItemMarkingRecordAuditSource);
      else setPrintSource("");
    }
    if (searchParams.has("kind")) {
      const kind = searchParams.get("kind");
      if (kind && ["MARKING", "KIZ", "DATAMATRIX", "GS1_DATAMATRIX"].includes(kind)) setKindFilter(kind as ItemMarkingRecord["kind"]);
      else setKindFilter("");
    }
  }, [searchParams]);

  const syncParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (itemFilter) next.set("item", itemFilter);
    else next.delete("item");
    if (printJobFilter.trim()) next.set("job", printJobFilter.trim());
    else next.delete("job");
    if (batchRefFilter.trim()) next.set("batchRef", batchRefFilter.trim());
    else next.delete("batchRef");
    if (printSource) next.set("src", printSource);
    else next.delete("src");
    if (kindFilter) next.set("kind", kindFilter);
    else next.delete("kind");
    setSearchParams(next, { replace: true });
  }, [searchParams, itemFilter, printJobFilter, batchRefFilter, printSource, kindFilter, setSearchParams]);

  const runConfirmUsed = useCallback(() => {
    setFeedback(null);
    if (selectedIds.length === 0) return;
    const r = reconcileBatchConfirmUsed(selectedIds, voidNote.trim() || undefined);
    setFeedback(
      t("master.markingReconciliation.feedbackBatch", {
        updated: r.updated,
        skipped: r.skipped,
        notApplicable: r.notApplicable,
      }),
    );
    setSelected(new Set());
  }, [selectedIds, voidNote, t]);

  const runRelease = useCallback(() => {
    setFeedback(null);
    if (selectedIds.length === 0) return;
    const r = reconcileBatchReleaseToAvailable(selectedIds, voidNote.trim() || undefined);
    setFeedback(
      t("master.markingReconciliation.feedbackBatch", {
        updated: r.updated,
        skipped: r.skipped,
        notApplicable: r.notApplicable,
      }),
    );
    setSelected(new Set());
  }, [selectedIds, voidNote, t]);

  const runExternalSync = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setSyncBusy(true);
    setFeedback(null);
    try {
      const r = await syncMarkingRecords(selectedIds, "FETCH_STATUS");
      const line = t("master.markingExternalSync.feedbackAfterSync", {
        status: r.status,
        logId: r.logId,
        ok: r.perRecord.filter((x) => x.ok).length,
        total: r.perRecord.length,
      });
      setFeedback(r.isMock ? `${line} ${t("master.markingExternalSync.mockBadgeShort")}` : line);
    } catch (e) {
      setFeedback(t("master.markingExternalSync.syncError", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSyncBusy(false);
    }
  }, [selectedIds, t]);

  const runVoid = useCallback(() => {
    setFeedback(null);
    if (selectedIds.length === 0) return;
    const r = reconcileBatchVoid(selectedIds, voidNote.trim() || undefined);
    setFeedback(
      t("master.markingReconciliation.feedbackBatch", {
        updated: r.updated,
        skipped: r.skipped,
        notApplicable: r.notApplicable,
      }),
    );
    setVoidNote("");
    setSelected(new Set());
  }, [selectedIds, voidNote, t]);

  const proposeBulkConfirmExternal = useCallback(() => {
    setFeedback(null);
    if (selectedIds.length === 0) return;
    const { eligible, skipped } = partitionSelected("confirm_used_externally");
    if (eligible.length === 0) {
      setFeedback(t("master.markingReconciliation.feedbackBulkNoneEligible", { n: skipped.length }));
      return;
    }
    setPendingExternal({ kind: "confirm", eligible, skipped });
  }, [selectedIds, partitionSelected, t]);

  const proposeBulkVoidExternal = useCallback(() => {
    setFeedback(null);
    if (selectedIds.length === 0) return;
    const { eligible, skipped } = partitionSelected("void_externally");
    if (eligible.length === 0) {
      setFeedback(t("master.markingReconciliation.feedbackBulkNoneEligible", { n: skipped.length }));
      return;
    }
    setPendingExternal({ kind: "void", eligible, skipped });
  }, [selectedIds, partitionSelected, t]);

  const executePendingExternal = useCallback(async () => {
    if (!pendingExternal) return;
    setSyncBusy(true);
    setFeedback(null);
    try {
      if (pendingExternal.kind === "confirm") {
        const r = await confirmMarkingRecordsUsedExternally(pendingExternal.eligible);
        setFeedback(
          t("master.markingReconciliation.feedbackExternalBatch", {
            action: t("master.markingReconciliation.actionConfirmExternal"),
            status: r.status,
            ok: r.perRecord.filter((x) => x.ok).length,
            total: r.perRecord.length,
            skipped: pendingExternal.skipped.length,
          }),
        );
      } else {
        const r = await voidMarkingRecordsExternally(pendingExternal.eligible);
        setFeedback(
          t("master.markingReconciliation.feedbackExternalBatch", {
            action: t("master.markingReconciliation.actionVoidExternal"),
            status: r.status,
            ok: r.perRecord.filter((x) => x.ok).length,
            total: r.perRecord.length,
            skipped: pendingExternal.skipped.length,
          }),
        );
      }
    } catch (e) {
      setFeedback(t("master.markingExternalSync.syncError", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSyncBusy(false);
      setPendingExternal(null);
      setSelected(new Set());
    }
  }, [pendingExternal, t]);

  const itemOptions = useMemo(
    () => [{ value: "", label: t("master.markingReconciliation.filterItemAll") }, ...items.map((it) => ({ value: it.id, label: `${it.code} · ${it.name}` }))],
    [items, t],
  );

  const traceabilityHref = useMemo(() => {
    const q = new URLSearchParams();
    if (itemFilter) q.set("item", itemFilter);
    if (printJobFilter.trim()) q.set("job", printJobFilter.trim());
    if (batchRefFilter.trim()) q.set("batchRef", batchRefFilter.trim());
    if (kindFilter) q.set("kind", kindFilter);
    if (printSource) q.set("src", printSource);
    const s = q.toString();
    return s ? `/items/marking-traceability?${s}` : "/items/marking-traceability";
  }, [itemFilter, printJobFilter, batchRefFilter, kindFilter, printSource]);

  const syncConsoleHref = useMemo(() => {
    const q = new URLSearchParams();
    if (printJobFilter.trim()) q.set("job", printJobFilter.trim());
    if (batchRefFilter.trim()) q.set("batchRef", batchRefFilter.trim());
    if (selectedIds.length) q.set("records", selectedIds.join(","));
    const s = q.toString();
    return s ? `/items/marking-sync?${s}` : "/items/marking-sync";
  }, [printJobFilter, batchRefFilter, selectedIds]);

  const jobSummary = useMemo(() => {
    if (!detailRow?.lastPrint?.printJobId) return null;
    return printJobRepository.getById(detailRow.lastPrint.printJobId);
  }, [detailRow]);

  return (
    <ItemsModuleLayout
      className="doc-page min-w-0 gap-3"
      contentVariant="wide"
      contentClassName="space-y-3 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <Link to="/items" className="text-primary hover:underline">
              {t("master.item.listBreadcrumb")}
            </Link>
          </p>
          <h1 className="text-base font-semibold tracking-tight">{t("master.markingReconciliation.title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{t("master.markingReconciliation.intro")}</p>
          <MarkingIntegrationModeBanner />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <Link to={traceabilityHref} className="text-primary underline-offset-2 hover:underline">
              {t("master.markingReconciliation.openTraceabilityHint")}
            </Link>
            <Link to={syncConsoleHref} className="text-primary underline-offset-2 hover:underline">
              {t("master.markingReconciliation.openSyncConsole")}
            </Link>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => syncParams()}>
          {t("master.markingReconciliation.saveFiltersToUrl")}
        </Button>
      </div>

      {feedback ? (
        <div role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          {feedback}
        </div>
      ) : null}

      {pendingExternal ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[11px] space-y-2" role="dialog">
          <p className="font-medium">
            {pendingExternal.kind === "confirm"
              ? t("master.markingReconciliation.pendingConfirmExternal", {
                  eligible: pendingExternal.eligible.length,
                  skipped: pendingExternal.skipped.length,
                })
              : t("master.markingReconciliation.pendingVoidExternal", {
                  eligible: pendingExternal.eligible.length,
                  skipped: pendingExternal.skipped.length,
                })}
          </p>
          <p className="text-muted-foreground">{t("master.markingReconciliation.pendingExternalHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" disabled={syncBusy} onClick={() => void executePendingExternal()}>
              {syncBusy ? t("master.markingExternalSync.syncRunning") : t("master.markingReconciliation.pendingConfirmApply")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={syncBusy} onClick={() => setPendingExternal(null)}>
              {t("master.markingReconciliation.pendingCancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <section className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingReconciliation.metricsTitle")}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {t("master.markingReconciliation.metricAttention")}: <strong className="tabular-nums">{summaryMetrics.attentionTotal}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricCritical")}: <strong className="tabular-nums text-red-700 dark:text-red-300">{summaryMetrics.criticalCount}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricNeverSynced")}: <strong className="tabular-nums">{summaryMetrics.neverSynced}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricSyncFailed")}: <strong className="tabular-nums">{summaryMetrics.syncFailed}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricStaleReserved")}: <strong className="tabular-nums">{summaryMetrics.staleReserved}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricStalePrinted")}: <strong className="tabular-nums">{summaryMetrics.stalePrinted}</strong>
          </span>
          <span>
            {t("master.markingReconciliation.metricConfirmationGaps")}: <strong className="tabular-nums">{summaryMetrics.confirmationGaps}</strong>
          </span>
        </div>
      </section>

      <section className="rounded-md border border-border/80 bg-card/40 p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.search")}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" placeholder={t("master.markingReconciliation.searchPlaceholder")} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.filterItem")}</Label>
            <SelectField value={itemFilter} onChange={setItemFilter} options={itemOptions} placeholder="" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.filterKind")}</Label>
            <SelectField
              value={kindFilter}
              onChange={(v) => setKindFilter(v as "" | ItemMarkingRecord["kind"])}
              options={KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.filterPrintJob")}</Label>
            <Input
              value={printJobFilter}
              onChange={(e) => setPrintJobFilter(e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder={t("master.markingReconciliation.filterPrintJobPlaceholder")}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.filterBatchRef")}</Label>
            <Input value={batchRefFilter} onChange={(e) => setBatchRefFilter(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.filterPrintSource")}</Label>
            <SelectField
              value={printSource}
              onChange={(v) => setPrintSource(v as "" | ItemMarkingRecordAuditSource)}
              options={PRINT_SOURCES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-2 border-t border-border/50 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-[11px] sm:col-span-2 lg:col-span-1">
            <Checkbox checked={mismatchOnly} onCheckedChange={(v) => setMismatchOnly(v === true)} id="mismatch-only" />
            <span>{t("master.markingReconciliation.filterMismatchOnly")}</span>
          </label>
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
              options={MISMATCH_KIND_FILTERS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              placeholder=""
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/50 pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">{t("master.markingReconciliation.statusFilters")}</span>
          {(
            [
              ["PRINTED", statusPrinted, setStatusPrinted],
              ["RESERVED", statusReserved, setStatusReserved],
              ["AVAILABLE", statusAvailable, setStatusAvailable],
              ["USED", statusUsed, setStatusUsed],
              ["VOID", statusVoid, setStatusVoid],
            ] as const
          ).map(([key, checked, set]) => (
            <label key={key} className="flex items-center gap-1.5 text-[11px]">
              <Checkbox checked={checked} onCheckedChange={(v) => set(v === true)} id={`st-${key}`} />
              <span>{t(`master.item.markingPool.status.${key}`)}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-[11px]">{t("master.markingReconciliation.noteOptional")}</Label>
            <Textarea value={voidNote} onChange={(e) => setVoidNote(e.target.value)} rows={2} className="text-xs min-h-0 max-h-24" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" className="h-8 text-xs" onClick={runConfirmUsed} disabled={selectedIds.length === 0}>
              {t("master.markingReconciliation.actionConfirmUsed")} ({selectedIds.length})
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={runRelease} disabled={selectedIds.length === 0}>
              {t("master.markingReconciliation.actionRelease")} ({selectedIds.length})
            </Button>
            <Button type="button" size="sm" variant="destructive" className="h-8 text-xs" onClick={runVoid} disabled={selectedIds.length === 0}>
              {t("master.markingReconciliation.actionVoid")} ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-violet-500/40 text-xs"
              onClick={() => void runExternalSync()}
              disabled={selectedIds.length === 0 || syncBusy}
            >
              {syncBusy ? t("master.markingExternalSync.syncRunning") : t("master.markingExternalSync.syncSelected")} ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={selectedIds.length === 0 || syncBusy}
              onClick={proposeBulkConfirmExternal}
            >
              {t("master.markingReconciliation.actionConfirmExternal")} ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={selectedIds.length === 0 || syncBusy}
              onClick={proposeBulkVoidExternal}
            >
              {t("master.markingReconciliation.actionVoidExternal")} ({selectedIds.length})
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={selectAllVisible}>
              {t("master.markingReconciliation.selectVisible")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelection}>
              {t("master.markingReconciliation.clearSelection")}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[1100px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                <th className="w-10 px-2 py-1.5" />
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colItem")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colKind")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colStatus")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colMismatchKind")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colSeverity")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colRecommend")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colPayload")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colBatchRef")}</th>
                <th className="px-2 py-1.5">{t("master.markingExternalSync.colExternal")}</th>
                <th className="px-2 py-1.5">{t("master.markingExternalSync.colSyncState")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colLastPrint")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    {t("master.markingReconciliation.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ record: r, item: it, lastPrint, analysis: a }) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b border-border/40 ${detailId === r.id ? "bg-muted/25" : ""}`}
                    onClick={() => setDetailId(r.id)}
                  >
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={(v) => toggleSelect(r.id, v === true)}
                        aria-label={t("master.markingReconciliation.selectRow")}
                      />
                    </td>
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
                    <td className="px-2 py-1.5 font-mono text-[10px]">{r.kind}</td>
                    <td className="px-2 py-1.5">{t(`master.item.markingPool.status.${r.status}`)}</td>
                    <td className="max-w-[7rem] px-2 py-1.5 text-[9px]">
                      {a.kind === "none" ? (
                        "—"
                      ) : (
                        <span className="rounded border border-border px-1 py-0.5 font-mono">{t(`master.markingReconciliation.mismatchKind.${a.kind}`)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {a.kind === "none" ? (
                        "—"
                      ) : (
                        <span
                          className={
                            a.severity === "error"
                              ? "rounded border border-red-500/50 bg-red-500/10 px-1 py-0.5 text-[9px] text-red-950 dark:text-red-100"
                              : a.severity === "warning"
                                ? "rounded border border-amber-500/50 bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-950 dark:text-amber-100"
                                : "rounded border border-sky-500/40 bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-950 dark:text-sky-100"
                          }
                        >
                          {t(`master.markingReconciliation.severity.${a.severity}`)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[8rem] px-2 py-1.5 text-[9px] text-muted-foreground" title={a.recommendedActionIds[0]}>
                      {a.recommendedActionIds.length
                        ? t(`master.markingReconciliation.actionHint.${a.recommendedActionIds[0]}`)
                        : "—"}
                    </td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5 font-mono text-[10px]" title={r.payload}>
                      {r.payload}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{r.batchRef ?? "—"}</td>
                    <td className="max-w-[6rem] truncate px-2 py-1.5 font-mono text-[10px]" title={r.externalStatus}>
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
                    <td className="px-2 py-1.5 text-[10px]">
                      {lastPrint?.printJobId ? (
                        <span className="font-mono" title={lastPrint.printJobId}>
                          {lastPrint.printJobId.slice(0, 10)}…
                        </span>
                      ) : (
                        "—"
                      )}
                      <div className="text-muted-foreground">{auditSourceLabel(t, lastPrint?.source)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-md border border-border/70 bg-card/30 p-3 space-y-2 text-[11px]">
          <p className="text-xs font-semibold">{t("master.markingReconciliation.detailTitle")}</p>
          {!detailRow ? (
            <p className="text-muted-foreground">{t("master.markingReconciliation.detailEmpty")}</p>
          ) : (
            <>
              <dl className="space-y-1">
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailItem")}</dt>
                  <dd>
                    {detailRow.item ? (
                      <Link className="text-primary hover:underline" to={`/items/${detailRow.item.id}`}>
                        {detailRow.item.code} · {detailRow.item.name}
                      </Link>
                    ) : (
                      detailRow.record.itemId
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailPayload")}</dt>
                  <dd className="break-all font-mono text-[10px]">{detailRow.record.payload}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailKind")}</dt>
                  <dd className="font-mono">{detailRow.record.kind}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailStatus")}</dt>
                  <dd>{t(`master.item.markingPool.status.${detailRow.record.status}`)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailSource")}</dt>
                  <dd>{detailRow.record.source ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailBatchRef")}</dt>
                  <dd className="font-mono">{detailRow.record.batchRef ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailSerial")}</dt>
                  <dd className="font-mono">{detailRow.record.serial ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailNote")}</dt>
                  <dd>{detailRow.record.note ?? "—"}</dd>
                </div>
                <div className="rounded border border-violet-500/35 bg-violet-500/5 p-2 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingReconciliation.detailReconciliation")}</p>
                  {detailRow.analysis.kind === "none" ? (
                    <p className="text-[10px] text-muted-foreground">{t("master.markingReconciliation.detailReconciliationOk")}</p>
                  ) : (
                    <>
                      <p className="text-[10px] leading-snug">{t(`master.markingReconciliation.explanation.${detailRow.analysis.explanationKey}`)}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {t("master.markingReconciliation.detailNextStep")}:{" "}
                        {detailRow.analysis.recommendedActionIds.length
                          ? t(`master.markingReconciliation.actionHint.${detailRow.analysis.recommendedActionIds[0]}`)
                          : "—"}
                      </p>
                    </>
                  )}
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    <Link className="text-primary hover:underline" to={`/items/marking-traceability?record=${encodeURIComponent(detailRow.record.id)}`}>
                      {t("master.markingReconciliation.linkOpenTraceabilityRecord")}
                    </Link>
                    <Link className="text-primary hover:underline" to={`/items/marking-sync?record=${encodeURIComponent(detailRow.record.id)}`}>
                      {t("master.markingReconciliation.linkOpenSyncRecord")}
                    </Link>
                  </div>
                </div>
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
                      <dt className="text-[9px] text-muted-foreground">{t("master.markingExternalSync.detailExternalRef")}</dt>
                      <dd className="font-mono text-[10px]">{detailRow.record.externalCodeRef ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
                {detailRow.lastPrint?.printJobId ? (
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">{t("master.markingReconciliation.detailPrintJob")}</dt>
                    <dd className="space-y-0.5">
                      <div className="font-mono text-[10px]">{detailRow.lastPrint.printJobId}</div>
                      <div className="text-muted-foreground">
                        {auditSourceLabel(t, detailRow.lastPrint.source)} ·{" "}
                        {new Date(detailRow.lastPrint.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </div>
                      {jobSummary ? (
                        <div className="text-[10px] text-muted-foreground">
                          {jobSummary.templateNameSnapshot ?? jobSummary.templateId} · {jobSummary.mode} · {jobSummary.copies}{" "}
                          {t("master.markingReconciliation.copiesSuffix")}
                        </div>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{t("master.markingReconciliation.detailAudit")}</p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[10px] leading-snug">
                  {[...detailAudit].reverse().map((e) => (
                    <li key={e.id} className="border-b border-border/30 pb-0.5">
                      {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} · {e.fromStatus ?? "—"} → {e.toStatus}{" "}
                      · {e.reason} · {auditSourceLabel(t, e.source)}
                      {e.printJobId ? ` · job ${e.printJobId.slice(0, 8)}…` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {t("master.markingReconciliation.footerHint", { visible: filteredRows.length })}
      </p>
    </ItemsModuleLayout>
  );
}
