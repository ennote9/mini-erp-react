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
import { itemRepository } from "../repository";

const ALL_STATUSES = ["PRINTED", "RESERVED", "AVAILABLE", "USED", "VOID"] as const;
type RowStatus = (typeof ALL_STATUSES)[number];

type EnrichedRow = {
  record: ItemMarkingRecord;
  item: Item | undefined;
  lastPrint: ItemMarkingRecordAuditEntry | undefined;
};

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

  const enrichedRows = useMemo((): EnrichedRow[] => {
    void revision;
    const records = markingRecordRepository.list();
    const out: EnrichedRow[] = [];
    for (const r of records) {
      out.push({
        record: r,
        item: itemById.get(r.itemId),
        lastPrint: getMarkingRecordLastPrintAudit(r.id),
      });
    }
    return out;
  }, [revision, itemById]);

  const activeStatuses = useMemo((): Set<RowStatus> => {
    const s = new Set<RowStatus>();
    if (statusPrinted) s.add("PRINTED");
    if (statusReserved) s.add("RESERVED");
    if (statusAvailable) s.add("AVAILABLE");
    if (statusUsed) s.add("USED");
    if (statusVoid) s.add("VOID");
    return s;
  }, [statusPrinted, statusReserved, statusAvailable, statusUsed, statusVoid]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const batchQ = batchRefFilter.trim().toLowerCase();
    const itemQ = itemFilter.trim();

    return enrichedRows.filter((row) => {
      const { record: r, item, lastPrint } = row;
      if (!activeStatuses.has(r.status as RowStatus)) return false;
      if (kindFilter && r.kind !== kindFilter) return false;
      if (itemQ && r.itemId !== itemQ) return false;
      if (jobIdsForPrintFilter && !jobIdsForPrintFilter.has(r.id)) return false;
      if (batchQ && !(r.batchRef ?? "").toLowerCase().includes(batchQ)) return false;
      if (printSource && lastPrint?.source !== printSource) return false;

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

  const itemOptions = useMemo(
    () => [{ value: "", label: t("master.markingReconciliation.filterItemAll") }, ...items.map((it) => ({ value: it.id, label: `${it.code} · ${it.name}` }))],
    [items, t],
  );

  const jobSummary = useMemo(() => {
    if (!detailRow?.lastPrint?.printJobId) return null;
    return printJobRepository.getById(detailRow.lastPrint.printJobId);
  }, [detailRow]);

  return (
    <div className="doc-page mx-auto max-w-[1600px] space-y-3 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            <Link to="/items" className="text-primary hover:underline">
              {t("master.item.listBreadcrumb")}
            </Link>
          </p>
          <h1 className="text-base font-semibold tracking-tight">{t("master.markingReconciliation.title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{t("master.markingReconciliation.intro")}</p>
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
          <table className="w-full min-w-[900px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                <th className="w-10 px-2 py-1.5" />
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colItem")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colKind")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colStatus")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colPayload")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colBatchRef")}</th>
                <th className="px-2 py-1.5">{t("master.markingReconciliation.colLastPrint")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {t("master.markingReconciliation.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ record: r, item: it, lastPrint }) => (
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
                    <td className="max-w-[12rem] truncate px-2 py-1.5 font-mono text-[10px]" title={r.payload}>
                      {r.payload}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{r.batchRef ?? "—"}</td>
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
    </div>
  );
}
