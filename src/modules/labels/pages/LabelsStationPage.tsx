import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository } from "@/modules/items/repository";
import {
  buildMarkingSnapshotFields,
  listSelectableMarkingRecordsForItem,
  markManyMarkingRecordsPrinted,
} from "@/modules/items/markingRecordService";
import type { Item } from "@/modules/items/model";
import { LABEL_PREVIEW_DEMO_CONTEXT, type LabelPreviewBindingContext } from "../lib/previewContext";
import { buildItemPreviewBindingContext, type ItemPreviewWarningCode } from "../lib/itemPreviewContext";
import { printLabelSurface } from "../lib/printLabelSurface";
import { saveLabelPdf } from "../lib/saveLabelPdf";
import {
  loadWorkspacePrintSettings,
  saveWorkspacePrintSettings,
} from "../lib/workspacePrintSettingsStorage";
import { validateWorkspaceForPrintJob } from "../lib/workspacePrintValidation";
import { collectLabelDomainIssues } from "../lib/labelDomainValidation";
import { LabelDomainIssuesBanner } from "../components/LabelDomainIssuesBanner";
import { LABELS_STATION_SOURCE } from "../lib/labelsStationConstants";
import { LABELS_STATION_QUERY } from "../lib/labelsStationQueryParams";
import { loadLabelsStationStorage, saveLabelsStationStorage } from "../lib/labelsStationStorage";
import { findStationSearchResult } from "../lib/labelsStationSearch";
import {
  createPrintJobFromWorkspace,
  getDefaultLabelTemplate,
  getLastLabelsStationRepeatableJob,
  listActiveLabelTemplates,
  markPrintJobFailed,
  markPrintJobSubmitted,
} from "../service";
import type { LabelTemplate } from "../model";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { WorkspaceItemContextBanner } from "../components/WorkspaceItemContextBanner";
import { LabelsSubnav } from "../components/LabelsSubnav";
import { cn } from "@/lib/utils";

type PreviewMode = "demo" | "item";

type Feedback =
  | { kind: "success"; message: string; variant?: "restore" }
  | { kind: "error"; message: string };

export function LabelsStationPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);
  const labelSurfaceRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionBusy, setActionBusy] = useState<"job" | "pdf" | "print" | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [pickCandidates, setPickCandidates] = useState<Item[] | null>(null);
  /** True when the last successful find matched a barcode scan (single candidate). */
  const [barcodeMatchHint, setBarcodeMatchHint] = useState(false);

  const itemId = searchParams.get(LABELS_STATION_QUERY.itemId) ?? "";
  const barcodeId = searchParams.get(LABELS_STATION_QUERY.barcodeId) ?? "";
  const markingRecordId = searchParams.get(LABELS_STATION_QUERY.markingRecordId) ?? "";
  const urlTemplateId = searchParams.get(LABELS_STATION_QUERY.templateId) ?? "";

  const [paperPreset, setPaperPreset] = useState(() => loadWorkspacePrintSettings().paperPreset);
  const [mediaPreset, setMediaPreset] = useState(() => loadWorkspacePrintSettings().mediaPreset);

  const item = useMemo(() => {
    void revision;
    return itemId ? itemRepository.getById(itemId) : undefined;
  }, [revision, itemId]);

  const markingPool = useMemo(() => {
    void revision;
    if (!item) return [];
    return listSelectableMarkingRecordsForItem(item.id);
  }, [revision, item]);

  const { previewContext, previewMode, itemWarnings, showItemNotFound } = useMemo((): {
    previewContext: LabelPreviewBindingContext;
    previewMode: PreviewMode;
    itemWarnings: ItemPreviewWarningCode[];
    showItemNotFound: boolean;
  } => {
    if (!itemId) {
      return {
        previewContext: LABEL_PREVIEW_DEMO_CONTEXT,
        previewMode: "demo",
        itemWarnings: [],
        showItemNotFound: false,
      };
    }
    if (!item) {
      return {
        previewContext: LABEL_PREVIEW_DEMO_CONTEXT,
        previewMode: "demo",
        itemWarnings: [],
        showItemNotFound: true,
      };
    }
    const built = buildItemPreviewBindingContext(item, {
      barcodeId: barcodeId || undefined,
      markingRecordId: markingRecordId || undefined,
    });
    return {
      previewContext: built.context,
      previewMode: "item",
      itemWarnings: built.warnings,
      showItemNotFound: false,
    };
  }, [itemId, item, barcodeId, markingRecordId]);

  const templates = useMemo((): LabelTemplate[] => {
    void revision;
    return listActiveLabelTemplates();
  }, [revision]);

  const [templateId, setTemplateId] = useState<string>("");
  const [copies, setCopies] = useState(() => loadWorkspacePrintSettings().copies);

  useEffect(() => {
    const c = searchParams.get(LABELS_STATION_QUERY.copies);
    if (!c) return;
    const n = Number.parseInt(c, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 999) setCopies(n);
  }, [searchParams]);

  useEffect(() => {
    saveWorkspacePrintSettings({ copies, paperPreset, mediaPreset });
  }, [copies, paperPreset, mediaPreset]);

  useEffect(() => {
    if (templates.length === 0) {
      setTemplateId("");
      return;
    }
    if (urlTemplateId && templates.some((x) => x.id === urlTemplateId)) {
      setTemplateId(urlTemplateId);
      return;
    }
    setTemplateId((prev) => {
      if (prev && templates.some((x) => x.id === prev)) return prev;
      const stored = loadLabelsStationStorage().lastTemplateId;
      if (stored && templates.some((x) => x.id === stored)) return stored;
      const def = getDefaultLabelTemplate();
      return def && templates.some((x) => x.id === def.id) ? def.id : templates[0].id;
    });
  }, [templates, urlTemplateId]);

  const setMarkingRecordParam = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set(LABELS_STATION_QUERY.markingRecordId, id);
      else next.delete(LABELS_STATION_QUERY.markingRecordId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!item || !templateId) return;
    if (markingRecordId) return;
    const tpl = templates.find((x) => x.id === templateId);
    if (!tpl) return;
    const needKiz = tpl.kind === "KIZ_LABEL";
    const needDm = tpl.kind === "DATAMATRIX_LABEL";
    if (!needKiz && !needDm) return;
    const candidates = needKiz
      ? markingPool.filter((r) => r.kind === "KIZ")
      : markingPool.filter((r) => r.kind === "DATAMATRIX" || r.kind === "GS1_DATAMATRIX");
    if (candidates.length !== 1) return;
    setMarkingRecordParam(candidates[0].id);
  }, [item, templateId, templates, markingRecordId, markingPool, setMarkingRecordParam]);

  const handleTemplateChange = useCallback(
    (id: string) => {
      setTemplateId(id);
      saveLabelsStationStorage({ lastTemplateId: id });
      const next = new URLSearchParams(searchParams);
      next.set(LABELS_STATION_QUERY.templateId, id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const selected = useMemo(
    () => (templateId ? templates.find((x) => x.id === templateId) : undefined),
    [templates, templateId],
  );

  const domainIssues = useMemo(() => {
    if (!selected || previewMode !== "item") return [];
    return collectLabelDomainIssues(selected, previewContext, t);
  }, [selected, previewMode, previewContext, t]);

  const domainBlocked = domainIssues.length > 0;

  const selectOptions = useMemo(
    () => templates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
    [templates],
  );

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

  const presetPayload = useMemo(
    () => ({
      paperPreset,
      mediaPreset,
      labelSizeMode: "template" as const,
    }),
    [paperPreset, mediaPreset],
  );

  const canOperate = previewMode === "item" && !!item && !showItemNotFound;

  const buildJobSnapshots = useCallback(() => {
    const itemIds = canOperate && item ? [item.id] : [];
    return {
      itemIds,
      barcodeId: barcodeId || undefined,
      ...buildMarkingSnapshotFields(markingRecordId || undefined),
      source: LABELS_STATION_SOURCE,
      isDemoContext: !canOperate,
      itemNameSnapshot: item?.name,
      itemCodeSnapshot: item?.code,
      barcodeValueSnapshot: previewContext.primaryBarcode || previewContext.selectedBarcode,
    };
  }, [
    canOperate,
    item,
    barcodeId,
    markingRecordId,
    previewContext.primaryBarcode,
    previewContext.selectedBarcode,
  ]);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const applyItemToUrl = useCallback(
    (
      nextItemId: string,
      nextBarcodeId?: string,
      patch?: { templateId?: string; copies?: number; markingRecordId?: string | null },
    ) => {
      const next = new URLSearchParams(searchParams);
      next.set(LABELS_STATION_QUERY.itemId, nextItemId);
      if (nextBarcodeId) next.set(LABELS_STATION_QUERY.barcodeId, nextBarcodeId);
      else next.delete(LABELS_STATION_QUERY.barcodeId);
      if (patch?.markingRecordId !== undefined) {
        if (patch.markingRecordId) next.set(LABELS_STATION_QUERY.markingRecordId, patch.markingRecordId);
        else next.delete(LABELS_STATION_QUERY.markingRecordId);
      } else {
        next.delete(LABELS_STATION_QUERY.markingRecordId);
      }
      if (patch?.templateId) next.set(LABELS_STATION_QUERY.templateId, patch.templateId);
      if (patch?.copies != null && patch.copies >= 1 && patch.copies <= 999) {
        next.set(LABELS_STATION_QUERY.copies, String(patch.copies));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const runSearch = useCallback(() => {
    setFeedback(null);
    setPickCandidates(null);
    setBarcodeMatchHint(false);
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
      return;
    }
    setBarcodeMatchHint(Boolean(result.barcodeId));
    applyItemToUrl(result.item.id, result.barcodeId);
    setSearchDraft("");
    focusSearch();
  }, [searchDraft, applyItemToUrl, t, focusSearch]);

  const handleRepeatLast = useCallback(() => {
    setFeedback(null);
    const job = getLastLabelsStationRepeatableJob();
    if (!job) {
      setFeedback({ kind: "error", message: t("labels.station.repeat.none") });
      return;
    }
    const first = job.itemIds[0];
    if (!first || !itemRepository.getById(first)) {
      setFeedback({ kind: "error", message: t("labels.station.repeat.itemMissing") });
      return;
    }
    if (job.paperPreset) setPaperPreset(job.paperPreset);
    if (job.mediaPreset) setMediaPreset(job.mediaPreset);
    setCopies(job.copies);
    setTemplateId(job.templateId);
    saveLabelsStationStorage({ lastTemplateId: job.templateId });
    applyItemToUrl(first, job.barcodeId, {
      templateId: job.templateId,
      copies: job.copies,
      markingRecordId: job.markingRecordId ?? null,
    });
    setPickCandidates(null);
    setSearchDraft("");
    setFeedback({ kind: "success", message: t("labels.station.repeat.restored"), variant: "restore" });
    focusSearch();
  }, [applyItemToUrl, t, focusSearch]);

  const handleCreateJob = useCallback(() => {
    setFeedback(null);
    if (!canOperate) {
      setFeedback({ kind: "error", message: t("labels.station.validation.noItem") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    if (domainBlocked) {
      return;
    }
    if (!selected) return;
    setActionBusy("job");
    try {
      createPrintJobFromWorkspace({
        templateId: selected.id,
        copies,
        mode: "print",
        status: "draft",
        ...buildJobSnapshots(),
        ...presetPayload,
      });
      setFeedback({ kind: "success", message: t("labels.workspace.feedback.jobCreated") });
    } catch (e) {
      setFeedback({
        kind: "error",
        message: t("labels.workspace.feedback.genericError"),
      });
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setActionBusy(null);
      focusSearch();
    }
  }, [canOperate, templateId, copies, selected, t, buildJobSnapshots, presetPayload, focusSearch, domainBlocked]);

  const handleSavePdf = useCallback(async () => {
    setFeedback(null);
    if (!canOperate) {
      setFeedback({ kind: "error", message: t("labels.station.validation.noItem") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    if (domainBlocked) {
      return;
    }
    const surface = labelSurfaceRef.current;
    if (!selected || !surface) {
      setFeedback({ kind: "error", message: t("labels.workspace.validation.NO_TEMPLATE") });
      return;
    }

    setActionBusy("pdf");
    const base = buildJobSnapshots();
    try {
      await saveLabelPdf({
        element: surface,
        sizeMm: selected.sizeMm,
        copies,
        filenameBase: `label-${selected.name}`,
      });
      createPrintJobFromWorkspace({
        templateId: selected.id,
        copies,
        mode: "pdf",
        status: "completed",
        ...base,
        ...presetPayload,
      });
      markManyMarkingRecordsPrinted(markingRecordId ? [markingRecordId] : []);
      setFeedback({ kind: "success", message: t("labels.workspace.feedback.pdfSaved") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        createPrintJobFromWorkspace({
          templateId: selected.id,
          copies,
          mode: "pdf",
          status: "failed",
          errorMessage: msg.slice(0, 500),
          ...base,
          ...presetPayload,
        });
      } catch (persistErr) {
        if (import.meta.env.DEV) console.error(persistErr);
      }
      setFeedback({
        kind: "error",
        message: `${t("labels.workspace.feedback.pdfFailed")} ${msg}`,
      });
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setActionBusy(null);
      focusSearch();
    }
  }, [
    canOperate,
    templateId,
    copies,
    selected,
    t,
    buildJobSnapshots,
    presetPayload,
    focusSearch,
    domainBlocked,
    markingRecordId,
  ]);

  const handlePrint = useCallback(async () => {
    setFeedback(null);
    if (!canOperate) {
      setFeedback({ kind: "error", message: t("labels.station.validation.noItem") });
      return;
    }
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
      return;
    }
    if (domainBlocked) {
      return;
    }
    const surface = labelSurfaceRef.current;
    if (!selected || !surface) {
      setFeedback({ kind: "error", message: t("labels.workspace.validation.NO_TEMPLATE") });
      return;
    }

    setActionBusy("print");
    const base = buildJobSnapshots();
    let jobId: string | undefined;
    try {
      const job = createPrintJobFromWorkspace({
        templateId: selected.id,
        copies,
        mode: "print",
        status: "queued",
        ...base,
        ...presetPayload,
      });
      jobId = job.id;
    } catch (e) {
      setFeedback({ kind: "error", message: t("labels.workspace.feedback.genericError") });
      if (import.meta.env.DEV) console.error(e);
      setActionBusy(null);
      focusSearch();
      return;
    }

    try {
      await printLabelSurface({
        sourceElement: surface,
        sizeMm: selected.sizeMm,
        copies,
      });
      if (jobId) markPrintJobSubmitted(jobId);
      markManyMarkingRecordsPrinted(markingRecordId ? [markingRecordId] : []);
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
      focusSearch();
    }
  }, [
    canOperate,
    templateId,
    copies,
    selected,
    t,
    buildJobSnapshots,
    presetPayload,
    focusSearch,
    domainBlocked,
    markingRecordId,
  ]);

  const markingSelectOptions = useMemo(
    () =>
      markingPool.map((r) => ({
        value: r.id,
        label: `${r.kind}${r.humanLabel ? ` · ${r.humanLabel}` : ""} · ${r.payload.slice(0, 24)}${r.payload.length > 24 ? "…" : ""}`,
      })),
    [markingPool],
  );

  const bannerProps =
    previewMode === "item" && item
      ? {
          source: LABELS_STATION_SOURCE,
          itemName: item.name,
          itemCode: item.code,
          selectedBarcode: previewContext.selectedBarcode,
          primaryBarcode: previewContext.primaryBarcode,
          warnings: itemWarnings,
        }
      : null;

  const activeBarcodes = useMemo(() => (item ? item.barcodes.filter((b) => b.isActive) : []), [item]);

  const effectiveBarcodeId = useMemo(() => {
    if (!item) return "";
    if (barcodeId) return barcodeId;
    const primary = activeBarcodes.find((b) => b.isPrimary) ?? activeBarcodes[0];
    return primary?.id ?? "";
  }, [item, barcodeId, activeBarcodes]);

  const selectCandidate = (picked: Item) => {
    setPickCandidates(null);
    setBarcodeMatchHint(false);
    applyItemToUrl(picked.id);
    setFeedback(null);
    focusSearch();
  };

  useEffect(() => {
    focusSearch();
  }, [focusSearch]);

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-3 p-3 md:p-4" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.station.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.station.intro")}</p>
      </header>

      {feedback ? (
        <div
          role="status"
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] leading-snug",
            feedback.kind === "success" && feedback.variant === "restore"
              ? "border-sky-500/40 bg-sky-500/10 text-foreground"
              : feedback.kind === "success"
                ? "border-emerald-500/35 bg-emerald-500/10 text-foreground"
                : "border-destructive/45 bg-destructive/10 text-foreground",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-md border border-border/80 bg-card/30 p-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[min(100%,18rem)] flex-1 space-y-1">
            <Label htmlFor="labels-station-search" className="text-[11px] text-muted-foreground">
              {t("labels.station.search.label")}
            </Label>
            <div className="flex gap-1.5">
              <Input
                ref={searchInputRef}
                id="labels-station-search"
                data-testid="labels-station-search"
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  setBarcodeMatchHint(false);
                }}
                placeholder={t("labels.station.search.placeholder")}
                className="h-8 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
              />
              <Button type="button" size="sm" className="h-8 shrink-0 px-3" onClick={runSearch}>
                {t("labels.station.search.find")}
              </Button>
            </div>
            {barcodeMatchHint && previewMode === "item" && item ? (
              <p className="text-[10px] text-emerald-800/90 dark:text-emerald-200/90">{t("labels.station.barcodeMatchedHint")}</p>
            ) : null}
          </div>
          <div className="w-[min(100%,14rem)] space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.selectTemplate")}</Label>
            <SelectField
              value={templateId}
              onChange={handleTemplateChange}
              options={selectOptions}
              placeholder={t("labels.workspace.selectTemplatePlaceholder")}
              aria-label={t("labels.workspace.selectTemplateAria")}
              disabled={templates.length === 0}
              className="w-full max-w-full"
            />
          </div>
          <div className="w-[4.5rem] space-y-1">
            <Label htmlFor="labels-station-copies" className="text-[11px] text-muted-foreground">
              {t("labels.workspace.copiesLabel")}
            </Label>
            <Input
              id="labels-station-copies"
              type="number"
              min={1}
              max={999}
              value={copies}
              disabled={!selected}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(n)) return;
                setCopies(Math.min(999, Math.max(1, n)));
              }}
              className="h-8"
            />
          </div>
        </div>
        {previewMode === "item" && item && markingPool.length > 0 ? (
          <div className="mt-2 w-full max-w-lg space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.markingRecordLabel")}</Label>
            <SelectField
              value={markingRecordId}
              onChange={(v) => setMarkingRecordParam(v)}
              options={[{ value: "", label: t("labels.workspace.markingRecordNone") }, ...markingSelectOptions]}
              placeholder={t("labels.workspace.markingRecordPlaceholder")}
              disabled={!selected}
              className="h-8 w-full max-w-full text-[11px]"
              aria-label={t("labels.workspace.markingRecordLabel")}
            />
          </div>
        ) : null}
      </section>

      {pickCandidates && pickCandidates.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px]"
          role="region"
          aria-label={t("labels.station.search.pickTitle")}
        >
          <p className="font-medium text-foreground">{t("labels.station.search.pickTitle")}</p>
          <p className="text-[10px] text-muted-foreground">{t("labels.station.search.pickSubtitle")}</p>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
            {pickCandidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded border border-border/50 bg-background/90 px-2 py-0.5 text-left text-[11px] hover:bg-muted/60"
                  onClick={() => selectCandidate(c)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 font-mono text-muted-foreground">{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showItemNotFound ? (
        <div
          className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-950 dark:text-amber-100"
          role="status"
        >
          {t("labels.workspace.contextBanner.itemNotFound")}
        </div>
      ) : null}

      {bannerProps ? <WorkspaceItemContextBanner {...bannerProps} compact /> : null}

      <LabelDomainIssuesBanner show={domainBlocked && canOperate} issues={domainIssues} />

      <div className="grid min-h-[260px] gap-2 lg:grid-cols-12" data-testid="labels-station">
        <section className="rounded-md border border-border/80 bg-card/40 p-2.5 lg:col-span-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.station.columnItem")}
          </h3>
          {previewMode === "item" && item ? (
            <div className="mt-2 space-y-2 text-xs">
              {activeBarcodes.length === 0 ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-100">{t("labels.station.noActiveBarcodes")}</p>
              ) : activeBarcodes.length === 1 ? (
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">{t("labels.station.singleBarcodeLabel")}</div>
                  <div className="font-mono text-[12px]">{activeBarcodes[0].codeValue}</div>
                </div>
              ) : (
                <div className="border-t border-border/50 pt-2">
                  <div className="mb-1 text-[10px] uppercase text-muted-foreground">{t("labels.station.barcodesTitle")}</div>
                  <div className="flex flex-col gap-0.5">
                    {activeBarcodes.map((b) => {
                      const isSel = b.id === effectiveBarcodeId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-left font-mono text-[11px] ${
                            isSel ? "border-primary bg-primary/10 shadow-sm" : "border-border/60 hover:bg-muted/50"
                          }`}
                          onClick={() => applyItemToUrl(item.id, b.id)}
                        >
                          <span className="min-w-0 truncate">{b.codeValue}</span>
                          {b.isPrimary ? (
                            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("labels.station.badgePrimaryBarcode")}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>{t("labels.station.noItem")}</p>
              <p className="text-[11px] leading-snug">{t("labels.station.emptyHint")}</p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-border/80 bg-card/40 p-2.5 lg:col-span-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.previewSection")}
          </h3>
          <div className="mt-2 min-h-[160px] overflow-auto rounded border border-dashed border-border/70 bg-muted/10 p-2">
            {selected ? (
              <LabelTemplatePreview
                ref={labelSurfaceRef}
                template={selected}
                context={previewContext}
                showDemoHint={previewMode === "demo"}
              />
            ) : (
              <div className="flex min-h-[140px] items-center justify-center text-center text-sm text-muted-foreground">
                {t("labels.workspace.previewPlaceholder")}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border/80 bg-card/40 p-2.5 lg:col-span-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.station.actionsTitle")}
          </h3>
          <div className="mt-2 flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 w-full justify-center"
              data-testid="labels-station-print"
              disabled={!selected || !canOperate || actionBusy !== null || domainBlocked}
                onClick={() => void handlePrint()}
            >
              {actionBusy === "print" ? t("common.loading") : t("labels.workspace.actions.print")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-full justify-center"
              data-testid="labels-station-save-pdf"
              disabled={!selected || !canOperate || actionBusy !== null || domainBlocked}
                onClick={() => void handleSavePdf()}
            >
              {actionBusy === "pdf" ? t("common.loading") : t("labels.workspace.actions.savePdf")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-full justify-center"
              data-testid="labels-station-create-job"
              disabled={!selected || !canOperate || actionBusy !== null || domainBlocked}
                onClick={handleCreateJob}
            >
              {actionBusy === "job" ? t("common.loading") : t("labels.workspace.actions.createJob")}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 w-full justify-center" onClick={handleRepeatLast}>
              {t("labels.station.repeat.button")}
            </Button>
          </div>

          <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.presets.paperLabel")}</Label>
              <SelectField
                value={paperPreset}
                onChange={setPaperPreset}
                options={paperOptions}
                placeholder=""
                disabled={!selected}
                className="w-full max-w-full"
                aria-label={t("labels.workspace.presets.paperLabel")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t("labels.workspace.presets.mediaLabel")}</Label>
              <SelectField
                value={mediaPreset}
                onChange={setMediaPreset}
                options={mediaOptions}
                placeholder=""
                disabled={!selected}
                className="w-full max-w-full"
                aria-label={t("labels.workspace.presets.mediaLabel")}
              />
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">{t("labels.workspace.presets.storedHint")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
