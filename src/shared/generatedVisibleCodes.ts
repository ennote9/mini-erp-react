const NON_ALNUM_RE = /[^A-Za-z0-9]/g;

function cleanUpper(input: string): string {
  return input.trim().toUpperCase().replace(NON_ALNUM_RE, "");
}

export function formatGeneratedVisibleCode(
  prefix: string,
  counter: number,
  width = 6,
): string {
  const safePrefix = cleanUpper(prefix);
  const n = Number.isFinite(counter) && counter > 0 ? Math.trunc(counter) : 1;
  return `${safePrefix}${String(n).padStart(width, "0")}`;
}

/**
 * Accepts both legacy separated format (e.g. SO-000001) and normalized format (SO000001).
 * Returns normalized prefix+digits or null when the value does not match this generated pattern.
 */
export function normalizeGeneratedVisibleCode(
  value: string,
  prefix: string,
): string | null {
  const safePrefix = cleanUpper(prefix);
  const cleaned = cleanUpper(value);
  if (!cleaned.startsWith(safePrefix)) return null;
  const tail = cleaned.slice(safePrefix.length);
  if (!/^\d+$/.test(tail) || tail.length === 0) return null;
  return `${safePrefix}${tail}`;
}

export function extractGeneratedVisibleCodeCounter(
  value: string,
  prefix: string,
): number | null {
  const normalized = normalizeGeneratedVisibleCode(value, prefix);
  if (!normalized) return null;
  const safePrefix = cleanUpper(prefix);
  const tail = normalized.slice(safePrefix.length);
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? n : null;
}

export function toGeneratedCodeSearchTokens(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const compact = q.replace(/[^a-z0-9]/g, "");
  if (!compact || compact === q) return [q];
  return [q, compact];
}

