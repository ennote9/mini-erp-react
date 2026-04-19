import type { ItemMarkingRecordKind } from "../model/itemMarkingRecord";
import type { MarkingExternalProviderId } from "../model/markingExternalSync";

export type MarkingExternalHealthResult = {
  ok: boolean;
  message?: string;
};

/** Non-sensitive HTTP call hint for sync logs (no secrets, no raw bodies). */
export type MarkingExternalSyncCallMeta = {
  method: string;
  path: string;
  httpStatus?: number;
  errorCode?: string;
};

/** Normalized snapshot returned by a provider for one pool record (opaque string labels). */
export type MarkingExternalFetchCodeStatusResult = {
  ok: boolean;
  externalStatus?: string;
  externalCodeRef?: string;
  message?: string;
  syncMeta?: MarkingExternalSyncCallMeta;
};

export type MarkingExternalPerRecordOutcome = {
  recordId: string;
  ok: boolean;
  message?: string;
  syncMeta?: MarkingExternalSyncCallMeta;
};

export type MarkingExternalBatchAckResult = {
  /** True when the whole batch is considered successful (all records ok). */
  ok: boolean;
  message?: string;
  externalReference?: string;
  /** Per-record outcomes from provider (drives PARTIAL in sync service). */
  perRecord?: readonly MarkingExternalPerRecordOutcome[];
  /** Single round-trip metadata when perRecord does not carry row-level info. */
  syncMeta?: MarkingExternalSyncCallMeta;
};

export type MarkingExternalRecordRef = {
  recordId: string;
  itemId: string;
  payload: string;
  kind: ItemMarkingRecordKind;
  externalCodeRef?: string;
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
    kind: ItemMarkingRecordKind;
    externalCodeRef?: string;
  }): Promise<MarkingExternalFetchCodeStatusResult>;

  /** Optional: bulk hint by batch reference (MVP may no-op). */
  fetchCodesByBatch?(batchRef: string): Promise<MarkingExternalFetchCodeStatusResult[]>;

  /** Notify external system that codes were consumed (does not imply internal transition). */
  confirmCodesUsed(records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult>;

  /** Notify external system to void codes. */
  voidCodes(records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult>;
}
