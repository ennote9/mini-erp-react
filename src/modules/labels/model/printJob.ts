import type { LabelTemplateKind } from "./labelTemplate";
import type { ItemMarkingRecordKind, ItemMarkingRecordStatus } from "@/modules/items/model/itemMarkingRecord";

export type PrintJobMode = "preview" | "print" | "pdf";

export type PrintJobStatus = "draft" | "queued" | "submitted" | "completed" | "failed";

export interface PrintJob {
  id: string;
  templateId: string;
  /** Denormalized for operations list without joining templates. */
  templateNameSnapshot?: string;
  /** Template kind at print time (domain workflows). */
  templateKindSnapshot?: LabelTemplateKind;
  itemIds: string[];
  /** Optional catalog context when job was created from workspace. */
  barcodeId?: string;
  /** Selected marking pool record (workspace / station) — audit trail. */
  markingRecordId?: string;
  markingPayloadSnapshot?: string;
  markingKindSnapshot?: ItemMarkingRecordKind;
  markingStatusSnapshot?: ItemMarkingRecordStatus;
  copies: number;
  mode: PrintJobMode;
  status: PrintJobStatus;
  /** Workspace print preset snapshot (paper / media). */
  paperPreset?: string;
  mediaPreset?: string;
  /** How physical page maps to template (future); `template` = use template mm as @page. */
  labelSizeMode?: "template" | "fit";
  /** e.g. `item-barcodes`, `workspace` — from URL. */
  source?: string;
  errorMessage?: string;
  /** True when workspace had no catalog item (demo preview context). */
  isDemoContext?: boolean;
  itemCodeSnapshot?: string;
  itemNameSnapshot?: string;
  barcodeValueSnapshot?: string;
  /** Batch print: number of catalog rows in the job. */
  rowsCount?: number;
  /** Batch print: sum of per-row copies (total labels). */
  totalLabels?: number;
  /** Short human-readable batch summary for lists (locale at save time). */
  batchSummarySnapshot?: string;
  /** JSON snapshot of batch rows for reopening the batch screen. */
  batchRowsSnapshot?: string;
  createdAt: string;
  updatedAt: string;
}
