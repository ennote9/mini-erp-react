export type MarkdownStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "WRITTEN_OFF" | "SUPERSEDED";

export type MarkdownReasonCode =
  | "DAMAGED_PACKAGING"
  | "EXPIRED_SOON"
  | "FOUND_OLD_MARKDOWN"
  | "DISPLAY_WEAR"
  | "NO_LONGER_SELLABLE_AS_REGULAR"
  | "OTHER";

export interface MarkdownRecord {
  id: string;
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
  locationId?: string;
  originalBarcode?: string;
  comment?: string;
  basePriceAtMarkdown?: number;
  closedAt?: string;
  closedBy?: string;
  /** When status is SUPERSEDED, points to the replacement ACTIVE (or later) unit. */
  supersededByMarkdownId?: string;
  /** When this record was created to replace another, links back to the superseded row. */
  supersedesMarkdownId?: string;
  quantity: 1;
}

