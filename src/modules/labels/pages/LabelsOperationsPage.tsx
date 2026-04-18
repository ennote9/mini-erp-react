import { useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { listPrintJobsForDisplay } from "../service";
import type { PrintJob } from "../model";
import { LabelsSubnav } from "../components/LabelsSubnav";

function workspaceUrlForJob(job: PrintJob, opts?: { reprint?: boolean }): string {
  const q = new URLSearchParams();
  q.set(LABELS_WORKSPACE_QUERY.templateId, job.templateId);
  q.set(LABELS_WORKSPACE_QUERY.copies, String(job.copies));
  const firstItem = job.itemIds[0];
  if (firstItem) q.set(LABELS_WORKSPACE_QUERY.itemId, firstItem);
  if (job.barcodeId) q.set(LABELS_WORKSPACE_QUERY.barcodeId, job.barcodeId);
  if (job.source) q.set(LABELS_WORKSPACE_QUERY.source, job.source);
  if (opts?.reprint) q.set(LABELS_WORKSPACE_QUERY.reprint, "1");
  return `/labels/workspace?${q.toString()}`;
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function LabelsOperationsPage() {
  const { t, locale } = useTranslation();
  const revision = useSyncExternalStore(subscribeAppReadModelRevision, getAppReadModelRevision, getAppReadModelRevision);

  const jobs = useMemo(() => {
    void revision;
    return listPrintJobsForDisplay();
  }, [revision]);

  return (
    <div className="labels-page mx-auto max-w-[1600px] space-y-4 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.operations.pageHeading")}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("labels.operations.intro")}</p>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("labels.operations.emptyTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("labels.operations.emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/80">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto_auto_auto] gap-x-2 border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.65fr)_minmax(0,0.65fr)_minmax(0,1.1fr)_auto_auto_auto]">
            <div>{t("labels.operations.columnWhen")}</div>
            <div>{t("labels.operations.columnMode")}</div>
            <div>{t("labels.operations.columnStatus")}</div>
            <div>{t("labels.operations.columnTemplate")}</div>
            <div className="text-right">{t("labels.operations.columnCopies")}</div>
            <div>{t("labels.operations.columnItem")}</div>
            <div className="text-right">{t("labels.operations.columnSource")}</div>
          </div>
          <ul className="divide-y divide-border/60">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto_auto_auto] gap-x-2 gap-y-1 px-3 py-2.5 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.65fr)_minmax(0,0.65fr)_minmax(0,1.1fr)_auto_auto_auto]"
              >
                <div className="min-w-0 tabular-nums text-muted-foreground">
                  {formatWhen(job.updatedAt, locale)}
                </div>
                <div className="min-w-0 text-foreground">{t(`labels.operations.mode.${job.mode}`)}</div>
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      job.status === "completed"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                        : job.status === "failed"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : job.status === "submitted"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                            : job.status === "queued"
                              ? "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100"
                              : "border-border bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {t(`labels.operations.status.${job.status}`)}
                  </span>
                  {job.status === "failed" && job.errorMessage ? (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive" title={job.errorMessage}>
                      {job.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 font-medium text-foreground">
                  <span className="truncate" title={job.templateNameSnapshot ?? job.templateId}>
                    {job.templateNameSnapshot ?? job.templateId}
                  </span>
                  {job.isDemoContext ? (
                    <span className="ml-1.5 rounded border border-border bg-muted/50 px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("labels.operations.badgeDemo")}
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right tabular-nums text-muted-foreground">{job.copies}</div>
                <div className="min-w-0 text-xs text-muted-foreground">
                  {job.itemNameSnapshot || job.itemCodeSnapshot ? (
                    <>
                      <span className="block truncate" title={job.itemNameSnapshot}>
                        {job.itemNameSnapshot ?? "—"}
                      </span>
                      {job.itemCodeSnapshot ? (
                        <span className="block truncate font-mono text-[11px]" title={job.itemCodeSnapshot}>
                          {job.itemCodeSnapshot}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground/80">—</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                  <span className="max-w-full truncate" title={job.source ?? ""}>
                    {job.source ?? "—"}
                  </span>
                  <Link
                    to={workspaceUrlForJob(job)}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {t("labels.operations.openWorkspace")}
                  </Link>
                  <Link
                    to={workspaceUrlForJob(job, { reprint: true })}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {t("labels.operations.reprint")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
