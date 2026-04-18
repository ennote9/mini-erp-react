import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository } from "@/modules/items/repository";
import { LABEL_PREVIEW_DEMO_CONTEXT } from "../lib/previewContext";
import { buildItemPreviewBindingContext } from "../lib/itemPreviewContext";
import { printBatchLabelSurfaces } from "../lib/printLabelSurface";
import { saveBatchLabelPdf, type BatchLabelPdfSegment } from "../lib/saveLabelPdf";
import {
  loadWorkspacePrintSettings,
  saveWorkspacePrintSettings,
} from "../lib/workspacePrintSettingsStorage";
import { validateWorkspaceForPrintJob } from "../lib/workspacePrintValidation";
import { findStationSearchResult } from "../lib/labelsStationSearch";
import { LABELS_BATCH_QUERY } from "../lib/labelsBatchQueryParams";
import { loadLabelsBatchStorage, saveLabelsBatchStorage } from "../lib/labelsBatchStorage";
import { parseBatchRowsSnapshot, serializeBatchRowsSnapshot } from "../lib/labelsBatchSnapshot";
import {
  buildBatchRowFromItem,
  refreshBatchRowFromItem,
  type LabelBatchTableRow,
} from "../lib/labelsBatchRowUtils";
import {
  createPrintJobFromBatch,
  getDefaultLabelTemplate,
  getLastLabelsBatchRepeatableJob,
  listActiveLabelTemplates,
  markPrintJobFailed,
  markPrintJobSubmitted,
} from "../service";
import { printJobRepository } from "../printJobRepository";
import type { LabelTemplate } from "../model";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { LabelsSubnav } from "../components/LabelsSubnav";
import type { Item } from "@/modules/items/model";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function waitNextPaint(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

export function LabelsBatchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const [rows, setRows] = useState<LabelBatchTableRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [pickCandidates, setPickCandidates] = useState<Item[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionBusy, setActionBusy] = useState<"job" | "pdf" | "print" | null>(null);
  const [exportRowId, setExportRowId] = useState<string | null>(null);
  const [massCopies, setMassCopies] = useState(1);

  const exportSurfaceRef = useRef<HTMLDivElement>(null);

  const [paperPreset, setPaperPreset] = useState(() => loadWorkspacePrintSettings().paperPreset);
  const [mediaPreset, setMediaPreset] = useState(() => loadWorkspacePrintSettings().mediaPreset);

  useEffect(() => {
    saveWorkspacePrintSettings({ paperPreset, mediaPreset });
  }, [paperPreset, mediaPreset]);

  const templates = useMemo((): LabelTemplate[] => {
    void revision;
    return listActiveLabelTemplates();
  }, [revision]);

  useEffect(() => {
    if (templates.length === 0) {
      setTemplateId("");
      return;
    }
    setTemplateId((prev) => {
      if (prev && templates.some((x) => x.id === prev)) return prev;
      const stored = loadLabelsBatchStorage().lastTemplateId;
      if (stored && templates.some((x) => x.id === stored)) return stored;
      const def = getDefaultLabelTemplate();
      return def && templates.some((x) => x.id === def.id) ? def.id : templates[0].id;
    });
  }, [templates]);

  const handleTemplateChange = useCallback((id: string) => {
    setTemplateId(id);
    saveLabelsBatchStorage({ lastTemplateId: id });
  }, []);

  const selectedTemplate = useMemo(
    () => (templateId ? templates.find((x) => x.id === templateId) : undefined),
    [templates, templateId],
  );

  const selectOptions = useMemo(
    () => templates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
    [templates],
  );

  const presetPayload = useMemo(
    () => ({
      paperPreset,
      mediaPreset,
      labelSizeMode: "template" as const,
    }),
    [paperPreset, mediaPreset],
  );

  useEffect(() => {
    setRows((prev) =>
      prev.map((row) => {
        const item = itemRepository.getById(row.itemId);
        return refreshBatchRowFromItem(row, item);
      }),
    );
  }, [revision]);

  const restoreApplied = useRef(false);
  const pendingRestoreTemplateId = useRef<string | null>(null);

  const restoreFromJobSnapshot = useCallback(
    (snapshot: string, templateHint?: string) => {
      const parsed = parseBatchRowsSnapshot(snapshot);
      const list = parsed?.rows;
      if (!list || list.length === 0) return false;
      const tplId = templateHint ?? parsed.templateId;
      if (tplId && templates.some((x) => x.id === tplId)) {
        setTemplateId(tplId);
        saveLabelsBatchStorage({ lastTemplateId: tplId });
        pendingRestoreTemplateId.current = null;
      } else if (tplId) {
        pendingRestoreTemplateId.current = tplId;
      }
      const built: LabelBatchTableRow[] = [];
      for (const r of list) {
        const item = itemRepository.getById(r.itemId);
        if (!item) continue;
        built.push(
          buildBatchRowFromItem(item, {
            barcodeId: r.barcodeId,
            copies: r.copies,
          }),
        );
      }
      if (built.length === 0) return false;
      setRows(built);
      setSelectedRowId(built[0].id);
      return true;
    },
    [templates],
  );

  useEffect(() => {
    const tid = pendingRestoreTemplateId.current;
    if (!tid) return;
    if (templates.some((x) => x.id === tid)) {
      setTemplateId(tid);
      saveLabelsBatchStorage({ lastTemplateId: tid });
      pendingRestoreTemplateId.current = null;
    }
  }, [templates]);

  useEffect(() => {
    const jid = searchParams.get(LABELS_BATCH_QUERY.restoreJob);
    if (!jid || restoreApplied.current) return;
    const job = printJobRepository.getById(jid);
    if (!job?.batchRowsSnapshot || job.source !== "labels-batch") return;
    restoreApplied.current = true;
    if (restoreFromJobSnapshot(job.batchRowsSnapshot, job.templateId)) {
      setFeedback({ kind: "success", message: t("labels.batch.feedback.restored") });
    }
    const next = new URLSearchParams(searchParams);
    next.delete(LABELS_BATCH_QUERY.restoreJob);
    setSearchParams(next, { replace: true });
  }, [searchParams, restoreFromJobSnapshot, setSearchParams, t]);

  const totalLabels = useMemo(() => rows.reduce((s, r) => s + (r.isValid ? r.copies : 0), 0), [rows]);
  const invalidCount = useMemo(() => rows.filter((r) => !r.isValid).length, [rows]);
  const canRunBatch = rows.length > 0 && invalidCount === 0 && !!selectedTemplate;

  const effectiveSelectedId = selectedRowId ?? rows[0]?.id ?? null;

  const selectedRow = useMemo(
    () => (effectiveSelectedId ? rows.find((r) => r.id === effectiveSelectedId) : undefined),
    [rows, effectiveSelectedId],
  );

  const previewItem = useMemo(() => {
    if (!selectedRow) return undefined;
    return itemRepository.getById(selectedRow.itemId);
  }, [selectedRow, revision]);

  const previewBuilt = useMemo(() => {
    if (!previewItem || !selectedRow) {
      return { context: LABEL_PREVIEW_DEMO_CONTEXT, mode: "demo" as const };
    }
    const b = buildItemPreviewBindingContext(previewItem, { barcodeId: selectedRow.barcodeId || undefined });
    return { context: b.context, mode: "item" as const };
  }, [previewItem, selectedRow, revision]);

  const paperOptions = useMemo(
    () => [
      { value: "AUTO", label: t("labels.workspace.presets.paper.AUTO") },
      { value: "LABEL", label: t("labels.paper.LABEL") },
      { value: "ROLL", label: t("labels.paper.ROLL") },
      { value: "A4", label: t("labels.paper.A4") },
      { value: "CUSTOM", label: t("labels.paper.CUSTOM") },
    ],
    [t],
  );

  const mediaOptions = useMemo(
    () => [
      { value: "DEFAULT", label: t("labels.workspace.presets.media.DEFAULT") },
      { value: "THERMAL", label: t("labels.workspace.presets.media.THERMAL") },
      { value: "SHEET", label: t("labels.workspace.presets.media.SHEET") },
    ],
    [t],
  );

  const addItemToRows = useCallback(
    (item: Item, barcodeId?: string) => {
      const next = buildBatchRowFromItem(item, { barcodeId });
      setRows((r) => [...r, next]);
      setSelectedRowId(next.id);
      setSearchDraft("");
      setPickCandidates(null);
    },
    [],
  );

  const tryAddFromSearch = useCallback(() => {
    setFeedback(null);
    const result = findStationSearchResult(searchDraft);
    if (result.kind === "empty") {
      setFeedback({ kind: "error", message: t("labels.station.search.emptyQuery") });
      return;
    }
    if (result.kind === "none") {
      setFeedback({ kind: "error", message: t("labels.station.search.notFound") });
      return;
    }
    if (result.kind === "pickItem") {
      setPickCandidates(result.items);
      setFeedback({ kind: "error", message: t("labels.station.search.pickPrompt") });
      return;
    }
    addItemToRows(result.item, result.barcodeId);
  }, [searchDraft, addItemToRows, t]);

  const handleClear = useCallback(() => {
    setRows([]);
    setSelectedRowId(null);
    setFeedback(null);
    setPickCandidates(null);
  }, []);

  const updateRowBarcode = useCallback((rowId: string, barcodeId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const item = itemRepository.getById(row.itemId);
        if (!item) return { ...row, isValid: false, validationMessage: "itemMissing" };
        return buildBatchRowFromItem(item, { barcodeId, copies: row.copies, rowId: row.id });
      }),
    );
  }, []);

  const updateRowCopies = useCallback((rowId: string, copies: number) => {
    const n = Math.min(999, Math.max(1, copies));
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const item = itemRepository.getById(row.itemId);
        if (!item) return { ...row, copies: n, isValid: false, validationMessage: "itemMissing" };
        return buildBatchRowFromItem(item, { barcodeId: row.barcodeId, copies: n, rowId: row.id });
      }),
    );
  }, []);

  const applyMassCopies = useCallback(() => {
    const n = Math.min(999, Math.max(1, massCopies));
    setRows((prev) =>
      prev.map((row) => {
        const item = itemRepository.getById(row.itemId);
        if (!item) return { ...row, copies: n, isValid: false, validationMessage: "itemMissing" };
        return buildBatchRowFromItem(item, { barcodeId: row.barcodeId, copies: n, rowId: row.id });
      }),
    );
  }, [massCopies]);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      setSelectedRowId((sid) => (sid === rowId ? next[0]?.id ?? null : sid));
      return next;
    });
  }, []);

  const buildSnapshotPayload = useCallback(() => {
    if (!selectedTemplate) throw new Error("NO_TEMPLATE");
    return serializeBatchRowsSnapshot({
      templateId: selectedTemplate.id,
      rows: rows.map((r) => ({
        itemId: r.itemId,
        barcodeId: r.barcodeId || undefined,
        copies: r.copies,
      })),
    });
  }, [rows, selectedTemplate]);

  const runExportSegments = useCallback(async (): Promise<BatchLabelPdfSegment[]> => {
    if (!selectedTemplate || !canRunBatch) throw new Error("BATCH_INVALID");
    const segments: BatchLabelPdfSegment[] = [];
    for (const row of rows) {
      if (!row.isValid) continue;
      flushSync(() => setExportRowId(row.id));
      await waitNextPaint();
      const el = exportSurfaceRef.current;
      if (!el) throw new Error("BATCH_EXPORT_NO_SURFACE");
      segments.push({
        element: el,
        sizeMm: selectedTemplate.sizeMm,
        copies: row.copies,
      });
    }
    flushSync(() => setExportRowId(null));
    await waitNextPaint();
    return segments;
  }, [rows, selectedTemplate, canRunBatch]);

  const summaryText = useMemo(() => {
    return t("labels.batch.summaryLine", {
      rows: rows.length,
      labels: totalLabels,
      invalid: invalidCount,
    });
  }, [rows.length, totalLabels, invalidCount, t]);

  const handleCreateJob = useCallback(() => {
    setFeedback(null);
    if (!canRunBatch || !selectedTemplate) {
      setFeedback({ kind: "error", message: t("labels.batch.validation.cannotRun") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, 1);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    setActionBusy("job");
    try {
      const itemIds = [...new Set(rows.map((r) => r.itemId))];
      const total = rows.reduce((s, r) => s + r.copies, 0);
      createPrintJobFromBatch({
        templateId: selectedTemplate.id,
        copies: total,
        mode: "print",
        status: "draft",
        itemIds,
        isDemoContext: false,
        itemNameSnapshot: t("labels.batch.jobName"),
        itemCodeSnapshot: `${rows.length}×${total}`,
        ...presetPayload,
        rowsCount: rows.length,
        totalLabels: total,
        batchSummarySnapshot: summaryText,
        batchRowsSnapshot: buildSnapshotPayload(),
      });
      setFeedback({ kind: "success", message: t("labels.batch.feedback.jobCreated") });
    } catch (e) {
      setFeedback({ kind: "error", message: t("labels.workspace.feedback.genericError") });
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setActionBusy(null);
    }
  }, [
    canRunBatch,
    selectedTemplate,
    templateId,
    rows,
    t,
    presetPayload,
    summaryText,
    buildSnapshotPayload,
  ]);

  const handleSavePdf = useCallback(async () => {
    setFeedback(null);
    if (!canRunBatch || !selectedTemplate) {
      setFeedback({ kind: "error", message: t("labels.batch.validation.cannotRun") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, 1);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    setActionBusy("pdf");
    try {
      const segments = await runExportSegments();
      await saveBatchLabelPdf({
        segments,
        filenameBase: `labels-batch-${selectedTemplate.name}`,
      });
      createPrintJobFromBatch({
        templateId: selectedTemplate.id,
        copies: segments.reduce((s, g) => s + g.copies, 0),
        mode: "pdf",
        status: "completed",
        itemIds: [...new Set(rows.map((r) => r.itemId))],
        isDemoContext: false,
        itemNameSnapshot: t("labels.batch.jobName"),
        itemCodeSnapshot: `${rows.length}×${totalLabels}`,
        ...presetPayload,
        rowsCount: rows.length,
        totalLabels,
        batchSummarySnapshot: summaryText,
        batchRowsSnapshot: buildSnapshotPayload(),
      });
      setFeedback({ kind: "success", message: t("labels.workspace.feedback.pdfSaved") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        createPrintJobFromBatch({
          templateId: selectedTemplate.id,
          copies: totalLabels,
          mode: "pdf",
          status: "failed",
          errorMessage: msg.slice(0, 500),
          itemIds: [...new Set(rows.map((r) => r.itemId))],
          isDemoContext: false,
          ...presetPayload,
          rowsCount: rows.length,
          totalLabels,
          batchSummarySnapshot: summaryText,
          batchRowsSnapshot: buildSnapshotPayload(),
        });
      } catch (persistErr) {
        if (import.meta.env.DEV) console.error(persistErr);
      }
      setFeedback({ kind: "error", message: `${t("labels.workspace.feedback.pdfFailed")} ${msg}` });
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setActionBusy(null);
    }
  }, [
    canRunBatch,
    selectedTemplate,
    templateId,
    runExportSegments,
    rows,
    totalLabels,
    t,
    presetPayload,
    summaryText,
    buildSnapshotPayload,
  ]);

  const handlePrint = useCallback(async () => {
    setFeedback(null);
    if (!canRunBatch || !selectedTemplate) {
      setFeedback({ kind: "error", message: t("labels.batch.validation.cannotRun") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, 1);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    setActionBusy("print");
    let jobId: string | undefined;
    try {
      const segments = await runExportSegments();
      const printSegments = segments.map((s) => ({
        sourceElement: s.element,
        sizeMm: s.sizeMm,
        copies: s.copies,
      }));
      const job = createPrintJobFromBatch({
        templateId: selectedTemplate.id,
        copies: segments.reduce((s, g) => s + g.copies, 0),
        mode: "print",
        status: "queued",
        itemIds: [...new Set(rows.map((r) => r.itemId))],
        isDemoContext: false,
        itemNameSnapshot: t("labels.batch.jobName"),
        itemCodeSnapshot: `${rows.length}×${totalLabels}`,
        ...presetPayload,
        rowsCount: rows.length,
        totalLabels,
        batchSummarySnapshot: summaryText,
        batchRowsSnapshot: buildSnapshotPayload(),
      });
      jobId = job.id;

      await printBatchLabelSurfaces(printSegments);
      if (jobId) markPrintJobSubmitted(jobId);
      setFeedback({ kind: "success", message: t("labels.workspace.feedback.printDialogDone") });
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      if (jobId) markPrintJobFailed(jobId, msg);
      setFeedback({
        kind: "error",
        message: `${t("labels.workspace.feedback.printFailed")} ${msg}`,
      });
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setActionBusy(null);
    }
  }, [
    canRunBatch,
    selectedTemplate,
    templateId,
    runExportSegments,
    rows,
    totalLabels,
    t,
    presetPayload,
    summaryText,
    buildSnapshotPayload,
  ]);

  const handleRepeatLastBatch = useCallback(() => {
    setFeedback(null);
    const job = getLastLabelsBatchRepeatableJob();
    if (!job?.batchRowsSnapshot) {
      setFeedback({ kind: "error", message: t("labels.batch.repeat.none") });
      return;
    }
    if (restoreFromJobSnapshot(job.batchRowsSnapshot, job.templateId)) {
      setFeedback({ kind: "success", message: t("labels.batch.feedback.restored") });
    } else {
      setFeedback({ kind: "error", message: t("labels.batch.repeat.none") });
    }
  }, [restoreFromJobSnapshot, t]);

  const exportRow = useMemo(() => {
    if (!exportRowId) return null;
    return rows.find((r) => r.id === exportRowId) ?? null;
  }, [exportRowId, rows]);

  const exportPreview = useMemo(() => {
    if (!exportRow || !selectedTemplate) return null;
    const item = itemRepository.getById(exportRow.itemId);
    if (!item) return null;
    return buildItemPreviewBindingContext(item, { barcodeId: exportRow.barcodeId || undefined });
  }, [exportRow, selectedTemplate, revision]);

  const rowValidationLabel = (code: string | undefined) => {
    if (!code) return "";
    const k = `labels.batch.rowMessages.${code}` as const;
    return t(k);
  };

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-3 p-3 md:p-4" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.batch.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.batch.intro")}</p>
      </header>

      {feedback ? (
        <div
          role="status"
          className={`rounded-md border px-2.5 py-1.5 text-xs ${
            feedback.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
              : "border-destructive/50 bg-destructive/10 text-foreground"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-md border border-border/80 bg-card/30 p-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[min(100%,16rem)] flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("labels.batch.searchLabel")}</Label>
            <div className="flex gap-1.5">
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t("labels.batch.searchPlaceholder")}
                className="h-8 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryAddFromSearch();
                  }
                }}
              />
              <Button type="button" size="sm" className="h-8 shrink-0" onClick={tryAddFromSearch}>
                {t("labels.batch.add")}
              </Button>
            </div>
          </div>
          <div className="w-[min(100%,14rem)] space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.selectTemplate")}</Label>
            <SelectField
              value={templateId}
              onChange={handleTemplateChange}
              options={selectOptions}
              placeholder={t("labels.workspace.selectTemplatePlaceholder")}
              disabled={templates.length === 0}
              className="w-full max-w-full"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleClear}>
              {t("labels.batch.clear")}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={handleRepeatLastBatch}>
              {t("labels.batch.repeatLast")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={!canRunBatch || actionBusy !== null || !selectedTemplate}
              onClick={handleCreateJob}
            >
              {actionBusy === "job" ? t("common.loading") : t("labels.workspace.actions.createJob")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={!canRunBatch || actionBusy !== null || !selectedTemplate}
              onClick={() => void handleSavePdf()}
            >
              {actionBusy === "pdf" ? t("common.loading") : t("labels.workspace.actions.savePdf")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!canRunBatch || actionBusy !== null || !selectedTemplate}
              onClick={() => void handlePrint()}
            >
              {actionBusy === "print" ? t("common.loading") : t("labels.workspace.actions.print")}
            </Button>
          </div>
        </div>
      </section>

      {pickCandidates && pickCandidates.length > 0 ? (
        <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs">
          <p className="font-medium">{t("labels.station.search.pickTitle")}</p>
          <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
            {pickCandidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded border border-border/60 bg-background/80 px-2 py-1 text-left text-xs hover:bg-muted/60"
                  onClick={() => addItemToRows(c)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 font-mono text-muted-foreground">{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{summaryText}</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={999}
                className="h-7 w-14"
                value={massCopies}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) setMassCopies(Math.min(999, Math.max(1, n)));
                }}
              />
              <Button type="button" size="sm" variant="outline" className="h-7" onClick={applyMassCopies} disabled={rows.length === 0}>
                {t("labels.batch.applyCopiesAll")}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/80">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5">{t("labels.batch.colCode")}</th>
                  <th className="px-2 py-1.5">{t("labels.batch.colName")}</th>
                  <th className="px-2 py-1.5">{t("labels.batch.colBarcode")}</th>
                  <th className="px-2 py-1.5 w-20">{t("labels.batch.colCopies")}</th>
                  <th className="px-2 py-1.5">{t("labels.batch.colStatus")}</th>
                  <th className="px-2 py-1.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      {t("labels.batch.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const item = itemRepository.getById(row.itemId);
                    const active = item?.barcodes.filter((b) => b.isActive) ?? [];
                    const bcOptions = active.map((b) => ({ value: b.id, label: b.codeValue }));
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-border/50 ${row.id === effectiveSelectedId ? "bg-muted/40" : "hover:bg-muted/20"}`}
                        onClick={() => setSelectedRowId(row.id)}
                      >
                        <td className="px-2 py-1.5 font-mono">{row.itemCode}</td>
                        <td className="max-w-[12rem] truncate px-2 py-1.5" title={row.itemName}>
                          {row.itemName}
                        </td>
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <SelectField
                            value={row.barcodeId}
                            onChange={(id) => updateRowBarcode(row.id, id)}
                            options={bcOptions}
                            placeholder="—"
                            className="h-7 max-w-[10rem] text-[11px]"
                            disabled={active.length === 0}
                          />
                        </td>
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            min={1}
                            max={999}
                            className="h-7 w-16"
                            value={row.copies}
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10);
                              if (!Number.isNaN(n)) updateRowCopies(row.id, n);
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          {row.isValid ? (
                            <span className="text-emerald-700 dark:text-emerald-300">OK</span>
                          ) : (
                            <span className="text-destructive" title={rowValidationLabel(row.validationMessage)}>
                              {rowValidationLabel(row.validationMessage)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-destructive" onClick={() => removeRow(row.id)}>
                            ×
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/40 p-2.5 lg:col-span-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("labels.batch.previewTitle")}</h3>
          <div className="mt-2 min-h-[200px] overflow-auto rounded border border-dashed border-border/70 bg-muted/10 p-2">
            {selectedTemplate && previewBuilt.mode === "item" ? (
              <LabelTemplatePreview
                template={selectedTemplate}
                context={previewBuilt.context}
                showDemoHint={false}
              />
            ) : (
              <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-muted-foreground">
                {t("labels.batch.previewPlaceholder")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.presets.paperLabel")}</Label>
          <SelectField
            value={paperPreset}
            onChange={setPaperPreset}
            options={paperOptions}
            placeholder=""
            className="w-full max-w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.presets.mediaLabel")}</Label>
          <SelectField
            value={mediaPreset}
            onChange={setMediaPreset}
            options={mediaOptions}
            placeholder=""
            className="w-full max-w-full"
          />
        </div>
      </div>

      <div
        className="pointer-events-none fixed left-[-12000px] top-0 z-[-1] opacity-100"
        aria-hidden
      >
        {exportRow && exportPreview && selectedTemplate ? (
          <LabelTemplatePreview
            ref={exportSurfaceRef}
            template={selectedTemplate}
            context={exportPreview.context}
            showDemoHint={false}
          />
        ) : null}
      </div>
    </div>
  );
}
