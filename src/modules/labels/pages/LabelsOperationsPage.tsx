import { useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/shared/i18n";
import { getAppReadModelRevision, subscribeAppReadModelRevision } from "@/shared/appReadModelRevision";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { LABELS_BATCH_SOURCE } from "../lib/labelsBatchConstants";
import { LABELS_STATION_SOURCE } from "../lib/labelsStationConstants";
import { buildLabelsBatchUrl } from "../lib/labelsBatchQueryParams";
import { labelTemplateRepository } from "../labelTemplateRepository";
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

function isBatchJob(job: PrintJob): boolean {
  return job.source === LABELS_BATCH_SOURCE;
}

function formatSourceLabel(job: PrintJob, t: (k: string) => string): string {
  if (isBatchJob(job)) return t("labels.operations.sourceBatch");
  if (job.source === LABELS_STATION_SOURCE) return t("labels.operations.sourceStation");
  if (job.source === "item-barcodes") return t("labels.operations.sourceFromItemBarcodes");
  return t("labels.operations.sourceWorkspace");
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
        <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">{t("labels.operations.emptyTitle")}</p>
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{t("labels.operations.emptyHintShort")}</p>
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
            {jobs.map((job) => {
              const batch = isBatchJob(job);
              const labelsCount = batch && job.totalLabels != null ? job.totalLabels : job.copies;
              const templateKind =
                job.templateKindSnapshot ?? labelTemplateRepository.getById(job.templateId)?.kind;
              return (
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
                    {batch && job.rowsCount != null ? (
                      <span className="ml-1.5 rounded border border-sky-500/35 bg-sky-500/10 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950 dark:text-sky-100">
                        {t("labels.operations.badgeBatch")} · {job.rowsCount}
                      </span>
                    ) : null}
                    {templateKind && templateKind !== "ITEM_LABEL" ? (
                      <span
                        className="ml-1.5 inline-block max-w-[10rem] truncate rounded border border-violet-500/35 bg-violet-500/10 px-1 py-0.5 text-[10px] font-medium text-violet-950 dark:text-violet-100"
                        title={t(`labels.kind.${templateKind}`)}
                      >
                        {t(`labels.kind.${templateKind}`)}
                      </span>
                    ) : null}
                    {batch && job.batchSummarySnapshot ? (
                      <p
                        className="mt-1 line-clamp-2 text-[11px] font-normal leading-snug text-muted-foreground"
                        title={job.batchSummarySnapshot}
                      >
                        {job.batchSummarySnapshot}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right tabular-nums text-muted-foreground">{labelsCount}</div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {batch ? (
                      <>
                        <span className="block truncate font-medium text-foreground" title={job.batchSummarySnapshot ?? ""}>
                          {job.batchSummarySnapshot ?? job.itemNameSnapshot ?? "—"}
                        </span>
                        {job.itemCodeSnapshot ? (
                          <span className="block truncate font-mono text-[11px]" title={job.itemCodeSnapshot}>
                            {job.itemCodeSnapshot}
                          </span>
                        ) : null}
                      </>
                    ) : job.itemNameSnapshot || job.itemCodeSnapshot ? (
                      <>
                        <span className="block truncate" title={job.itemNameSnapshot}>
                          {job.itemNameSnapshot ?? "—"}
                        </span>
                        {job.itemCodeSnapshot ? (
                          <span className="block truncate font-mono text-[11px]" title={job.itemCodeSnapshot}>
                            {job.itemCodeSnapshot}
                          </span>
                        ) : null}
                        {job.markingRecordId || job.markingPayloadSnapshot ? (
                          <span
                            className="mt-0.5 block max-w-full truncate font-mono text-[10px] text-violet-700/90 dark:text-violet-300/90"
                            title={job.markingPayloadSnapshot ?? job.markingRecordId}
                          >
                            {t("labels.operations.markingHint")}:{" "}
                            {(job.markingPayloadSnapshot ?? job.markingRecordId ?? "").slice(0, 42)}
                            {(job.markingPayloadSnapshot ?? job.markingRecordId ?? "").length > 42 ? "…" : ""}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground/80">—</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-1.5 text-right text-[11px]">
                    <span
                      className="max-w-full truncate text-[10px] uppercase tracking-wide text-muted-foreground"
                      title={formatSourceLabel(job, t)}
                    >
                      {formatSourceLabel(job, t)}
                    </span>
                    {batch ? (
                      <Link
                        to={buildLabelsBatchUrl({ restoreJob: job.id })}
                        className="rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary underline-offset-2 hover:bg-primary/10 hover:underline"
                      >
                        {t("labels.operations.batchRestore")}
                      </Link>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
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
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
