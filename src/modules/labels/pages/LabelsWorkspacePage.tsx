import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { itemRepository } from "@/modules/items/repository";
import { LABEL_PREVIEW_DEMO_CONTEXT, type LabelPreviewBindingContext } from "../lib/previewContext";
import { buildItemPreviewBindingContext, type ItemPreviewWarningCode } from "../lib/itemPreviewContext";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { getDefaultLabelTemplate, listActiveLabelTemplates } from "../service";
import type { LabelTemplate } from "../model";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { WorkspaceItemContextBanner } from "../components/WorkspaceItemContextBanner";
import { LabelsSubnav } from "../components/LabelsSubnav";

type PreviewMode = "demo" | "item";

export function LabelsWorkspacePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const itemId = searchParams.get(LABELS_WORKSPACE_QUERY.itemId) ?? "";
  const barcodeId = searchParams.get(LABELS_WORKSPACE_QUERY.barcodeId) ?? "";
  const urlTemplateId = searchParams.get(LABELS_WORKSPACE_QUERY.templateId) ?? "";
  const source = searchParams.get(LABELS_WORKSPACE_QUERY.source);

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
  const [copies, setCopies] = useState<number>(1);

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

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.workspace.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.workspace.intro")}</p>
      </header>

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
        </section>

        <section className="rounded-md border border-border/80 bg-card/40 p-3 lg:col-span-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.workspace.previewSection")}
          </h3>
          <div className="mt-3 min-h-[180px] overflow-auto rounded border border-dashed border-border/70 bg-muted/10 p-3">
            {selected ? (
              <LabelTemplatePreview
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
          <div className="mt-3 space-y-2">
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
        </section>
      </div>
    </div>
  );
}
