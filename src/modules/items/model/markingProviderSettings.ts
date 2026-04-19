/**
 * Persisted configuration for external marking integration (separate from marking records).
 * MVP: local JSON; not a secure vault — treat apiKey as sensitive in UI but stored like other app data.
 */

export type MarkingProviderMode = "mock" | "real" | "disabled";

export interface MarkingProviderSettings {
  /** Logical id (e.g. mock, http, or future provider key). */
  providerId: string;
  mode: MarkingProviderMode;
  /** When false, sync operations are blocked (adapter resolves to disabled). */
  isEnabled: boolean;
  baseUrl?: string;
  /** Opaque token / API key placeholder. */
  apiKey?: string;
  timeoutMs?: number;
  updatedAt: string;
}

export const DEFAULT_MARKING_PROVIDER_SETTINGS: MarkingProviderSettings = {
  providerId: "mock",
  mode: "mock",
  isEnabled: true,
  timeoutMs: 15_000,
  updatedAt: new Date(0).toISOString(),
};
