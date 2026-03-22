/**
 * Preparatory helper: substitute `{{trackingNumber}}` in a carrier template.
 * Returns null if template or tracking number is missing/blank (no URL to open).
 */
export function buildCarrierTrackingUrl(
  template: string | undefined,
  trackingNumber: string | undefined,
): string | null {
  const t = template?.trim();
  const n = trackingNumber?.trim();
  if (!t || !n) return null;
  const out = t.replace(/\{\{\s*trackingNumber\s*\}\}/gi, n);
  try {
    const u = new URL(out);
    return u.protocol === "http:" || u.protocol === "https:" ? out : null;
  } catch {
    return null;
  }
}
