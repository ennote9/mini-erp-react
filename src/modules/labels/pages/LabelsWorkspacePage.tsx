import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { LABEL_PREVIEW_DEMO_CONTEXT } from "../lib/previewContext";
import {
  getDefaultLabelTemplate,
  listActiveLabelTemplates,
} from "../service";
import type { LabelTemplate } from "../model";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { LabelsSubnav } from "../components/LabelsSubnav";

export function LabelsWorkspacePage() {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

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
    const stillValid = templateId !== "" && templates.some((x) => x.id === templateId);
    if (stillValid) return;
    const def = getDefaultLabelTemplate();
    const next = def && templates.some((x) => x.id === def.id) ? def.id : templates[0].id;
    setTemplateId(next);
  }, [templates, templateId]);

  const selected = useMemo(
    () => (templateId ? templates.find((x) => x.id === templateId) : undefined),
    [templates, templateId],
  );

  const selectOptions = useMemo(
    () => templates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
    [templates],
  );

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.workspace.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.workspace.intro")}</p>
      </header>

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
                  onChange={setTemplateId}
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
              <LabelTemplatePreview template={selected} context={LABEL_PREVIEW_DEMO_CONTEXT} />
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
