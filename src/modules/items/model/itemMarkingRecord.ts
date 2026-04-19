/**
 * Per-unit marking codes for an item (pool for KIZ / DataMatrix / GS1, etc.).
 * Scalar fields on {@link Item} remain the compatibility fallback when no records exist.
 */

export type ItemMarkingRecordKind = "MARKING" | "KIZ" | "DATAMATRIX" | "GS1_DATAMATRIX";

export type ItemMarkingRecordStatus = "AVAILABLE" | "RESERVED" | "PRINTED" | "USED" | "VOID";

export type ItemMarkingRecordSource = "MANUAL" | "IMPORT" | "GENERATED" | "OTHER";

export interface ItemMarkingRecord {
  id: string;
  itemId: string;
  kind: ItemMarkingRecordKind;
  /** Encoded or raw payload used for printing / DataMatrix. */
  payload: string;
  /** Optional short label for UI lists. */
  humanLabel?: string;
  status: ItemMarkingRecordStatus;
  source?: ItemMarkingRecordSource;
  batchRef?: string;
  serial?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
