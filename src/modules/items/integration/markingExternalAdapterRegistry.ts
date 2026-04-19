import type { MarkingExternalAdapter } from "./markingExternalAdapterTypes";
import { markingProviderSettingsRepository } from "../markingProviderSettingsRepository";
import { createMockMarkingExternalAdapter } from "./mockMarkingExternalAdapter";
import { createDisabledMarkingExternalAdapter } from "./disabledMarkingExternalAdapter";
import { createHttpMarkingExternalAdapter } from "./httpMarkingExternalAdapter";
import {
  getCachedMarkingExternalAdapter,
  setCachedMarkingExternalAdapter,
  invalidateMarkingExternalAdapterCache,
} from "./markingAdapterCache";

export { invalidateMarkingExternalAdapterCache };

function resolveAdapter(): MarkingExternalAdapter {
  const s = markingProviderSettingsRepository.get();
  if (!s.isEnabled || s.mode === "disabled") {
    return createDisabledMarkingExternalAdapter();
  }
  if (s.mode === "mock") {
    return createMockMarkingExternalAdapter();
  }
  return createHttpMarkingExternalAdapter(s);
}

/**
 * Active adapter follows persisted provider settings. Cache is invalidated when settings change.
 * Pages should use markingExternalSyncService / markingProviderSettingsService, not this directly.
 */
export function getActiveMarkingExternalAdapter(): MarkingExternalAdapter {
  let c = getCachedMarkingExternalAdapter();
  if (c) return c;
  c = resolveAdapter();
  setCachedMarkingExternalAdapter(c);
  return c;
}
