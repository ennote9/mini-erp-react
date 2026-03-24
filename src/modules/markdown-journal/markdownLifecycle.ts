import type { MarkdownStatus } from "./model";

const FINAL: ReadonlySet<MarkdownStatus> = new Set([
  "SOLD",
  "CANCELLED",
  "WRITTEN_OFF",
  "SUPERSEDED",
]);

export function isFinalMarkdownStatus(status: MarkdownStatus): boolean {
  return FINAL.has(status);
}

/** Final states reachable in one step from ACTIVE without creating a replacement row. */
export type MarkdownDirectTerminalTransition = "SOLD" | "CANCELLED" | "WRITTEN_OFF";

/**
 * SUPERSEDED is only applied when replacing a unit with a new markdown record
 * (`supersedeMarkdownRecord`); do not use a bare status edit.
 */
export function canTransitionMarkdown(
  from: MarkdownStatus,
  _to: MarkdownDirectTerminalTransition,
): boolean {
  return from === "ACTIVE";
}

export function assertMarkdownTransitionAllowed(
  from: MarkdownStatus,
  to: MarkdownDirectTerminalTransition,
): void {
  if (!canTransitionMarkdown(from, to)) {
    throw new Error(`Invalid markdown transition: ${from} → ${to}`);
  }
}
