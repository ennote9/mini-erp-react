import type {
  MarkingExternalAdapter,
  MarkingExternalBatchAckResult,
  MarkingExternalFetchCodeStatusResult,
  MarkingExternalHealthResult,
} from "./markingExternalAdapterTypes";

/** Deterministic non-crypto hash for stable mock outputs. */
function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Predictable mock provider for wiring and demos. Not production truth — `isMock` is true.
 * External labels use MOCK_* prefixes so mismatch helpers can map them semantically.
 */
export function createMockMarkingExternalAdapter(): MarkingExternalAdapter {
  const EXTERNAL_STATUSES = [
    "MOCK_ACTIVE",
    "MOCK_RESERVED",
    "MOCK_PRINTED",
    "MOCK_APPLIED",
    "MOCK_VOID",
  ] as const;

  return {
    id: "mock",
    displayName: "Mock marking registry",
    isMock: true,

    async healthcheck(): Promise<MarkingExternalHealthResult> {
      return { ok: true, message: "mock-not-production" };
    },

    async fetchCodeStatus(input: {
      recordId: string;
      itemId: string;
      payload: string;
    }): Promise<MarkingExternalFetchCodeStatusResult> {
      const h = djb2Hash(`${input.recordId}|${input.payload}|${input.itemId}`);
      const idx = h % EXTERNAL_STATUSES.length;
      let externalStatus = EXTERNAL_STATUSES[idx];

      // Optional escape hatch for tests/manual rows: force "stale print" external view.
      if (input.payload.includes("__EXT_STALE_PRINT__")) {
        externalStatus = "MOCK_PRINTED";
      }
      if (input.payload.includes("__EXT_APPLIED__")) {
        externalStatus = "MOCK_APPLIED";
      }

      return {
        ok: true,
        externalStatus,
        externalCodeRef: `mock-ref-${input.recordId}`,
        message: "mock-fetch-success",
      };
    },

    async confirmCodesUsed(recordIds: readonly string[]): Promise<MarkingExternalBatchAckResult> {
      return {
        ok: true,
        externalReference: `mock-confirm-${recordIds.length}-${Date.now()}`,
        message: "mock-confirm-used",
      };
    },

    async voidCodes(recordIds: readonly string[]): Promise<MarkingExternalBatchAckResult> {
      return {
        ok: true,
        externalReference: `mock-void-${recordIds.length}-${Date.now()}`,
        message: "mock-void-ack",
      };
    },
  };
}
