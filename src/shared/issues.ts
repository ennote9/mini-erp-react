/**
 * Shared issue model for document health, validation, and future app-wide error display.
 * Kept small and explicit for reuse across PO/SO and later modules.
 */

export type IssueSeverity = "error" | "warning" | "info";

export type IssueScope = "document" | "line" | "field" | "action" | "system";

export type Issue = {
  severity: IssueSeverity;
  scope: IssueScope;
  message: string;
  /** Line reference for line-level issues (e.g. _lineId). */
  lineId?: number;
  /** Field reference for field-level issues. */
  field?: string;
  /** Optional code for i18n or grouping. */
  code?: string;
};

/** Tailwind classes for severity in shared issue presentation (e.g. IssueBlock). */
export const issueSeverityClassName: Record<IssueSeverity, string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-zinc-400",
};

/** Normalize message for display deduplication: trim and collapse internal whitespace. */
function normalizeMessageKey(msg: string): string {
  return msg.trim().replace(/\s+/g, " ");
}

/** Deduplicate by normalized key, preserving first occurrence text and order. */
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

/** Single-pass: error and warning message arrays (for strip/panel). Deduplicated by normalized text. Used by PO/SO. */
export function getErrorAndWarningMessages(issues: Issue[]): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const i of issues) {
    if (i.severity === "error") errors.push(i.message);
    else if (i.severity === "warning") warnings.push(i.message);
  }
  return {
    errors: dedupeByNormalizedKey(errors),
    warnings: dedupeByNormalizedKey(warnings),
  };
}

/** True if any issue in the list has the same normalized message (for avoiding duplicate action issues). */
export function issueListContainsMessage(issues: Issue[], message: string): boolean {
  const key = normalizeMessageKey(message);
  return issues.some((i) => normalizeMessageKey(i.message) === key);
}

/** Combine multiple issue arrays into one (e.g. health.issues + actionIssues). */
export function combineIssues(...groups: Issue[][]): Issue[] {
  return groups.flat();
}

/** True if the list contains at least one error. */
export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** True if the list contains at least one warning. */
export function hasWarnings(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "warning");
}

/** Create an action-scope error issue (e.g. save/confirm/cancel/create-receipt failure). */
export function actionIssue(message: string): Issue {
  return { severity: "error", scope: "action", message };
}

/** Create a field-scope issue (e.g. required header field or form field). */
export function fieldIssue(
  severity: IssueSeverity,
  field: string,
  message: string,
): Issue {
  return { severity, scope: "field", field, message };
}
