export const LABELS_BATCH_QUERY = {
  restoreJob: "restoreJob",
} as const;

export function buildLabelsBatchUrl(params: { restoreJob?: string }): string {
  const q = new URLSearchParams();
  if (params.restoreJob) q.set(LABELS_BATCH_QUERY.restoreJob, params.restoreJob);
  const s = q.toString();
  return s ? `/labels/batch?${s}` : "/labels/batch";
}
