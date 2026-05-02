/**
 * Version string embedded in workspace backup manifests.
 * Set `VITE_APP_VERSION` at build time when release metadata is wired; until then exports use "unknown".
 */
export function getAppVersionForBackupExport(): string {
  const raw = (import.meta.env as { readonly VITE_APP_VERSION?: string }).VITE_APP_VERSION;
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.length > 0 ? v : "unknown";
}
