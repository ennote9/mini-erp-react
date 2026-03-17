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

/** Document-level error messages from an issue list (for strip/panel and confirm blocking). */
export function getDocumentErrors(issues: Issue[]): string[] {
  return issues.filter((i) => i.severity === "error").map((i) => i.message);
}

/** Document-level warning messages from an issue list (for strip/panel). */
export function getDocumentWarnings(issues: Issue[]): string[] {
  return issues.filter((i) => i.severity === "warning").map((i) => i.message);
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
