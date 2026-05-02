/**
 * Formats a persistence or flush failure for user-facing messages.
 * Prefix is human-readable context; non-Errors stringify like the previous inline helper.
 */
export function formatPersistenceFailure(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}
