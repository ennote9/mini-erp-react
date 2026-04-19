import type {
  MarkingExternalAdapter,
  MarkingExternalBatchAckResult,
  MarkingExternalFetchCodeStatusResult,
  MarkingExternalHealthResult,
  MarkingExternalRecordRef,
} from "./markingExternalAdapterTypes";

export function createDisabledMarkingExternalAdapter(): MarkingExternalAdapter {
  return {
    id: "disabled",
    displayName: "Disabled (marking sync off)",
    isMock: false,

    async healthcheck(): Promise<MarkingExternalHealthResult> {
      return { ok: false, message: "provider_disabled" };
    },

    async fetchCodeStatus(): Promise<MarkingExternalFetchCodeStatusResult> {
      return { ok: false, message: "provider_disabled" };
    },

    async confirmCodesUsed(_records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult> {
      return { ok: false, message: "provider_disabled" };
    },

    async voidCodes(_records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult> {
      return { ok: false, message: "provider_disabled" };
    },
  };
}
