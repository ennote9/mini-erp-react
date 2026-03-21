import type { Issue } from "./issues";

/**
 * Shared rule for factual document detail pages (Receipt, Shipment):
 *
 * 1. **Action issues first** — If the user just triggered an action that failed (e.g. Cancel
 *    document), those messages replace draft validation in the strip until the next successful
 *    action clears `actionIssues`.
 * 2. **Pre-post validation** — While the document is Draft and there are no action issues, show
 *    the full output of `validate*Full(id)` so blocking reasons are visible before Post.
 * 3. **Posted / cancelled** — No draft strip; strip appears only if `actionIssues` is non-empty
 *    (rare edge cases).
 */
export function factualDocumentIssuesForStrip(
  actionIssues: Issue[],
  isDraft: boolean,
  documentId: string | undefined,
  validateFull: (id: string) => Issue[],
): Issue[] {
  if (actionIssues.length > 0) return actionIssues;
  if (isDraft && documentId) return validateFull(documentId);
  return [];
}
