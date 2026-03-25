import type { MarkdownJournalStatus, MarkdownReasonCode, MarkdownStatus } from "./model";

export const MARKDOWN_REASONS: MarkdownReasonCode[] = [
  "DAMAGED_PACKAGING",
  "EXPIRED_SOON",
  "FOUND_OLD_MARKDOWN",
  "DISPLAY_WEAR",
  "NO_LONGER_SELLABLE_AS_REGULAR",
  "OTHER",
];

export const MARKDOWN_STATUS_FILTERS: Array<MarkdownStatus | "all"> = [
  "all",
  "ACTIVE",
  "SOLD",
  "CANCELLED",
  "WRITTEN_OFF",
  "SUPERSEDED",
];

export const MARKDOWN_JOURNAL_STATUS_FILTERS: Array<MarkdownJournalStatus | "all"> = [
  "all",
  "draft",
  "posted",
];

function parseIsoDatePrefix(iso: string): string {
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

export function inCreatedRange(iso: string, from: string, to: string): boolean {
  const day = parseIsoDatePrefix(iso);
  if (!day) return true;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
