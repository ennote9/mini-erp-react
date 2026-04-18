import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository } from "@/modules/items/repository";
import { LABEL_PREVIEW_DEMO_CONTEXT, type LabelPreviewBindingContext } from "../lib/previewContext";
import { buildItemPreviewBindingContext, type ItemPreviewWarningCode } from "../lib/itemPreviewContext";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { printLabelSurface } from "../lib/printLabelSurface";
import { saveLabelPdf } from "../lib/saveLabelPdf";
import {
  loadWorkspacePrintSettings,
  saveWorkspacePrintSettings,
} from "../lib/workspacePrintSettingsStorage";
import { validateWorkspaceForPrintJob } from "../lib/workspacePrintValidation";
import {
  createPrintJobFromWorkspace,
  getDefaultLabelTemplate,
  listActiveLabelTemplates,
  markPrintJobFailed,
  markPrintJobSubmitted,
} from "../service";
import type { LabelTemplate } from "../model";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { WorkspaceItemContextBanner } from "../components/WorkspaceItemContextBanner";
import { LabelsSubnav } from "../components/LabelsSubnav";

type PreviewMode = "demo" | "item";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function LabelsWorkspacePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);
  const labelSurfaceRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionBusy, setActionBusy] = useState<"job" | "pdf" | "print" | null>(null);

  const itemId = searchParams.get(LABELS_WORKSPACE_QUERY.itemId) ?? "";
  const barcodeId = searchParams.get(LABELS_WORKSPACE_QUERY.barcodeId) ?? "";
  const urlTemplateId = searchParams.get(LABELS_WORKSPACE_QUERY.templateId) ?? "";
  const source = searchParams.get(LABELS_WORKSPACE_QUERY.source);
  const reprintFromHistory = searchParams.get(LABELS_WORKSPACE_QUERY.reprint) === "1";

  const [paperPreset, setPaperPreset] = useState(() => loadWorkspacePrintSettings().paperPreset);
  const [mediaPreset, setMediaPreset] = useState(() => loadWorkspacePrintSettings().mediaPreset);

  const item = useMemo(() => {
    void revision;
    return itemId ? itemRepository.getById(itemId) : undefined;
  }, [revision, itemId]);

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
    const built = buildItemPreviewBindingContext(item, { barcodeId: barcodeId || undefined });
    return {
      previewContext: built.context,
      previewMode: "item",
      itemWarnings: built.warnings,
      showItemNotFound: false,
    };
  }, [itemId, item, barcodeId]);

  const templates = useMemo((): LabelTemplate[] => {
    void revision;
    return listActiveLabelTemplates();
  }, [revision]);

  const [templateId, setTemplateId] = useState<string>("");
  const [copies, setCopies] = useState(() => loadWorkspacePrintSettings().copies);

  useEffect(() => {
    const c = searchParams.get(LABELS_WORKSPACE_QUERY.copies);
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
      const def = getDefaultLabelTemplate();
      return def && templates.some((x) => x.id === def.id) ? def.id : templates[0].id;
    });
  }, [templates, urlTemplateId]);

  const handleTemplateChange = useCallback(
    (id: string) => {
      setTemplateId(id);
      const next = new URLSearchParams(searchParams);
      next.set(LABELS_WORKSPACE_QUERY.templateId, id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const selected = useMemo(
    () => (templateId ? templates.find((x) => x.id === templateId) : undefined),
    [templates, templateId],
  );

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

  const bannerProps =
    previewMode === "item" && item
      ? {
          source,
          itemName: item.name,
          itemCode: item.code,
          selectedBarcode: previewContext.selectedBarcode,
          primaryBarcode: previewContext.primaryBarcode,
          warnings: itemWarnings,
        }
      : null;

  const presetPayload = useMemo(
    () => ({
      paperPreset,
      mediaPreset,
      labelSizeMode: "template" as const,
    }),
    [paperPreset, mediaPreset],
  );

  const buildJobSnapshots = useCallback(() => {
    const itemIds = itemId && item && !showItemNotFound ? [itemId] : [];
    return {
      itemIds,
      barcodeId: barcodeId || undefined,
      source: source ?? undefined,
      isDemoContext: previewMode === "demo",
      itemNameSnapshot: item?.name,
      itemCodeSnapshot: item?.code,
      barcodeValueSnapshot: previewContext.primaryBarcode || previewContext.selectedBarcode,
    };
  }, [
    itemId,
    item,
    showItemNotFound,
    barcodeId,
    source,
    previewMode,
    previewContext.primaryBarcode,
    previewContext.selectedBarcode,
  ]);

  const handleCreateJob = useCallback(() => {
    setFeedback(null);
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
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
    }
  }, [templateId, copies, selected, t, buildJobSnapshots, presetPayload]);

  const handleSavePdf = useCallback(async () => {
    setFeedback(null);
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
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
    }
  }, [templateId, copies, selected, t, buildJobSnapshots, presetPayload]);

  const handlePrint = useCallback(async () => {
    setFeedback(null);
    const code = validateWorkspaceForPrintJob(templateId, copies);
    if (code) {
      setFeedback({ kind: "error", message: t(`labels.workspace.validation.${code}`) });
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
      return;
    }

    try {
      await printLabelSurface({
        sourceElement: surface,
        sizeMm: selected.sizeMm,
        copies,
      });
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
  }, [templateId, copies, selected, t, buildJobSnapshots, presetPayload]);

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.workspace.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.workspace.intro")}</p>
      </header>

      {feedback ? (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
              : "border-destructive/50 bg-destructive/10 text-foreground"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {reprintFromHistory ? (
        <div
          className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-foreground"
          role="status"
        >
          {t("labels.workspace.reprintHint")}
        </div>
      ) : null}

      {showItemNotFound ? (
        <div
          className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
          role="status"
        >
          {t("labels.workspace.contextBanner.itemNotFound")}
        </div>
      ) : null}

      {bannerProps ? <WorkspaceItemContextBanner {...bannerProps} /> : null}

      <div className="grid min-h-[280px] gap-3 lg:grid-cols-12">
        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.templateSection")}
          </h3>
          <div className="mt-3 space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("labels.workspace.noTemplates")}</p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="labels-ws-template" className="text-xs text-muted-foreground">
                  {t("labels.workspace.selectTemplate")}
                </Label>
                <SelectField
                  id="labels-ws-template"
                  value={templateId}
                  onChange={handleTemplateChange}
                  options={selectOptions}
                  placeholder={t("labels.workspace.selectTemplatePlaceholder")}
                  aria-label={t("labels.workspace.selectTemplateAria")}
                  className="w-full max-w-full"
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("labels.workspace.actions.sectionTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!selected || actionBusy !== null}
                onClick={handleCreateJob}
              >
                {actionBusy === "job" ? t("common.loading") : t("labels.workspace.actions.createJob")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!selected || actionBusy !== null}
                onClick={() => void handleSavePdf()}
              >
                {actionBusy === "pdf" ? t("common.loading") : t("labels.workspace.actions.savePdf")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="border border-primary/30"
                disabled={!selected || actionBusy !== null}
                onClick={() => void handlePrint()}
              >
                {actionBusy === "print" ? t("common.loading") : t("labels.workspace.actions.print")}
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{t("labels.workspace.actions.hintPrint")}</p>
          </div>
        </section>

        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.previewSection")}
          </h3>
          <div className="mt-3 min-h-[180px] overflow-auto rounded border border-dashed border-border/70 bg-muted/10 p-3">
            {selected ? (
              <LabelTemplatePreview
                ref={labelSurfaceRef}
                template={selected}
                context={previewContext}
                showDemoHint={previewMode === "demo"}
              />
            ) : (
              <div className="flex min-h-[160px] items-center justify-center text-center text-sm text-muted-foreground">
                {t("labels.workspace.previewPlaceholder")}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.paramsSection")}
          </h3>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="labels-ws-copies" className="text-xs text-muted-foreground">
                {t("labels.workspace.copiesLabel")}
              </Label>
              <Input
                id="labels-ws-copies"
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
                className="h-9"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">{t("labels.workspace.copiesHint")}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.workspace.presets.paperLabel")}</Label>
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
              <Label className="text-xs text-muted-foreground">{t("labels.workspace.presets.mediaLabel")}</Label>
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
            <p className="text-[11px] leading-snug text-muted-foreground">{t("labels.workspace.presets.storedHint")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
