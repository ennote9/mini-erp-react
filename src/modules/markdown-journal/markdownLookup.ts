import { markdownRepository } from "./repository";
import type { MarkdownRecord } from "./model";

/** Normalizes user/scan input for markdown code comparison (trim + uppercase). */
export function normalizeMarkdownCodeInput(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Stage-1 canonical pattern: MD + 8 digits (e.g. MD00000001).
 * Used to prefer markdown-first resolution in search/autocomplete flows.
 */
export function isMarkdownCodeFormat(raw: string): boolean {
  return /^MD\d{8}$/i.test(raw.trim());
}

export function resolveMarkdownRecordByScanInput(raw: string): MarkdownRecord | undefined {
  const q = normalizeMarkdownCodeInput(raw);
  if (!q.startsWith("MD")) return undefined;
  return markdownRepository.getByCode(q);
}
