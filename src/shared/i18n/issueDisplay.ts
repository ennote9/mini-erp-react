import type { Issue } from "../issues";
import type { TFunction } from "./resolve";

function normalizeMessageKey(msg: string): string {
  return msg.trim().replace(/\s+/g, " ");
}

function dedupeByNormalizedKey(messages: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const msg of messages) {
    const key = normalizeMessageKey(msg);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(msg);
  }
  return out;
}

/** Resolved user-visible text for one issue (uses i18n when present). */
export function formatIssueForDisplay(issue: Issue, t: TFunction): string {
  if (issue.i18nKey) {
    return t(issue.i18nKey, issue.i18nParams as Record<string, string> | undefined);
  }
  return issue.message;
}

/** Split issues into deduplicated translated error/warning lines for strips and panels. */
export function issuesToDisplayLists(
  issues: Issue[],
  t: TFunction,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const i of issues) {
    const line = formatIssueForDisplay(i, t);
    if (i.severity === "error") errors.push(line);
    else if (i.severity === "warning") warnings.push(line);
  }
  return {
    errors: dedupeByNormalizedKey(errors),
    warnings: dedupeByNormalizedKey(warnings),
  };
}
