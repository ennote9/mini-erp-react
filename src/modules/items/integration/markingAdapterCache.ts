import type { MarkingExternalAdapter } from "./markingExternalAdapterTypes";

let cached: MarkingExternalAdapter | null = null;

export function getCachedMarkingExternalAdapter(): MarkingExternalAdapter | null {
  return cached;
}

export function setCachedMarkingExternalAdapter(adapter: MarkingExternalAdapter | null): void {
  cached = adapter;
}

/** Call after provider settings change or for tests. */
export function invalidateMarkingExternalAdapterCache(): void {
  cached = null;
}
