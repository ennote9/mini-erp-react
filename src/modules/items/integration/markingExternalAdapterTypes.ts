import type { MarkingExternalProviderId } from "../model/markingExternalSync";

export type MarkingExternalHealthResult = {
  ok: boolean;
  message?: string;
};

/** Normalized snapshot returned by a provider for one pool record (opaque string labels). */
export type MarkingExternalFetchCodeStatusResult = {
  ok: boolean;
  externalStatus?: string;
  externalCodeRef?: string;
  message?: string;
};

export type MarkingExternalBatchAckResult = {
  ok: boolean;
  message?: string;
  externalReference?: string;
};

/**
 * Transport-agnostic contract. Implementations may be HTTP, mock, or IPC — callers use only this surface.
 */
export interface MarkingExternalAdapter {
  readonly id: MarkingExternalProviderId;
  readonly displayName: string;
  /** True for stub/mock — UI must surface this honestly. */
  readonly isMock: boolean;

  healthcheck(): Promise<MarkingExternalHealthResult>;

  fetchCodeStatus(input: {
    recordId: string;
    itemId: string;
    payload: string;
  }): Promise<MarkingExternalFetchCodeStatusResult>;

  /** Optional: bulk hint by batch reference (MVP may no-op). */
  fetchCodesByBatch?(batchRef: string): Promise<MarkingExternalFetchCodeStatusResult[]>;

  /** Notify external system that codes were consumed (does not imply internal transition). */
  confirmCodesUsed(recordIds: readonly string[]): Promise<MarkingExternalBatchAckResult>;

  /** Notify external system to void codes. */
  voidCodes(recordIds: readonly string[]): Promise<MarkingExternalBatchAckResult>;
}
