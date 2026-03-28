import type { StockStyle } from "@/shared/inventoryStyle";

export type MarkdownStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "WRITTEN_OFF" | "SUPERSEDED";

export type MarkdownJournalStatus = "draft" | "posted" | "cancelled";

export type MarkdownReasonCode =
  | "DAMAGED_PACKAGING"
  | "EXPIRED_SOON"
  | "FOUND_OLD_MARKDOWN"
  | "DISPLAY_WEAR"
  | "NO_LONGER_SELLABLE_AS_REGULAR"
  | "OTHER";

export interface MarkdownRecord {
  id: string;
  journalId?: string;
  journalNumber?: string;
  journalLineId?: string;
  batchId?: string;
  /** 1-based index within batch (optional; for traceability / future labels). */
  batchSequenceIndex?: number;
  /** Total units in the originating batch create (optional). */
  batchSequenceTotal?: number;
  itemId: string;
  markdownCode: string;
  markdownPrice: number;
  reasonCode: MarkdownReasonCode;
  status: MarkdownStatus;
  createdAt: string;
  createdBy: string;
  warehouseId: string;
  style: StockStyle;
  originalBarcode?: string;
  comment?: string;
  basePriceAtMarkdown?: number;
  printCount: number;
  printedAt?: string;
  closedAt?: string;
  closedBy?: string;
  /** When status is SUPERSEDED, points to the replacement ACTIVE (or later) unit. */
  supersededByMarkdownId?: string;
  /** When this record was created to replace another, links back to the superseded row. */
  supersedesMarkdownId?: string;
  quantity: 1;
}

export interface MarkdownJournal {
  id: string;
  number: string;
  status: MarkdownJournalStatus;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  comment?: string;
  createdAt: string;
  createdBy: string;
  postedAt?: string;
  postedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  /**
   * Migration bridge for old pre-journal unit records. Values may contain old batch IDs
   * and/or single-record IDs so migrated journals can still resolve their generated units.
   * New journals should rely on journalId on generated unit records instead.
   */
  legacySourceIds?: string[];
}

export interface MarkdownJournalLine {
  id: string;
  journalId: string;
  sortOrder: number;
  itemId: string;
  markdownPrice: number;
  quantity: number;
  reasonCode: MarkdownReasonCode;
}
