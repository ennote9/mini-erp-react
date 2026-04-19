import type { ItemMarkingRecordStatus } from "./itemMarkingRecord";

/**
 * Who caused a lifecycle transition (persisted on the audit entry).
 * Distinct from {@link import("./itemMarkingRecord").ItemMarkingRecordSource} (provenance of the code itself).
 */
export type ItemMarkingRecordAuditSource =
  | "manual"
  | "print_workspace"
  | "print_station"
  | "print_batch"
  | "import"
  | "void"
  | "mark_used"
  | "release"
  | "reconciliation"
  | "system";

/** Append-only history row for marking record status changes. */
export interface ItemMarkingRecordAuditEntry {
  id: string;
  markingRecordId: string;
  itemId: string;
  fromStatus: ItemMarkingRecordStatus | null;
  toStatus: ItemMarkingRecordStatus;
  /** Short machine reason, e.g. `reserve`, `print_success`, `import`. */
  reason: string;
  source: ItemMarkingRecordAuditSource;
  printJobId?: string;
  note?: string;
  createdAt: string;
}
