import { useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { listLabelTemplatesForDisplay } from "../service";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { LabelsSubnav } from "../components/LabelsSubnav";

function formatSizeMm(width: number, height: number): string {
  return `${width}×${height}`;
}

function workspaceUrlForTemplate(templateId: string): string {
  const q = new URLSearchParams();
  q.set(LABELS_WORKSPACE_QUERY.templateId, templateId);
  return `/labels/workspace?${q.toString()}`;
}

export function LabelsListPage() {
  const { t } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const templates = useMemo(() => {
    void revision;
    return listLabelTemplatesForDisplay();
  }, [revision]);

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.list.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.list.intro")}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("labels.list.skeletonTitle")}
        </span>
        <Button type="button" size="sm" disabled aria-label={t("labels.list.createTemplateAria")}>
          {t("labels.list.createTemplate")}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("labels.list.emptyTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("labels.list.emptyHint")}</p>
          <p className="mt-6 text-xs text-muted-foreground/90">{t("labels.list.skeletonHint")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/80">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-x-3 border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div>{t("labels.list.columnName")}</div>
            <div>{t("labels.list.columnKind")}</div>
            <div className="text-right">{t("labels.list.columnSize")}</div>
            <div className="text-right">{t("labels.list.columnActions")}</div>
          </div>
          <ul className="divide-y divide-border/60">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 font-medium text-foreground">
                  <span className="truncate" title={tpl.name}>
                    {tpl.name}
                  </span>
                  {tpl.description ? (
                    <p className="truncate text-xs font-normal text-muted-foreground" title={tpl.description}>
                      {tpl.description}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tpl.isDefault ? (
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("labels.list.badgeDefault")}
                      </span>
                    ) : null}
                    {tpl.isArchived ? (
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("labels.list.badgeArchived")}
                      </span>
                    ) : null}
                    {tpl.isSystem ? (
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("labels.list.badgeSystem")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 text-muted-foreground">
                  {t(`labels.kind.${tpl.kind}`)}
                </div>
                <div className="shrink-0 whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {formatSizeMm(tpl.sizeMm.width, tpl.sizeMm.height)}{" "}
                  <span className="text-xs text-muted-foreground/80">({t(`labels.paper.${tpl.paperType}`)})</span>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link to={`/labels/templates/${tpl.id}`}>{t("labels.list.editTemplate")}</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                    <Link to={workspaceUrlForTemplate(tpl.id)}>{t("labels.list.openWorkspace")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
