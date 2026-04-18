export type PrintJobMode = "preview" | "print" | "pdf";

export type PrintJobStatus = "draft" | "queued" | "submitted" | "completed" | "failed";

export interface PrintJob {
  id: string;
  templateId: string;
  /** Denormalized for operations list without joining templates. */
  templateNameSnapshot?: string;
  itemIds: string[];
  /** Optional catalog context when job was created from workspace. */
  barcodeId?: string;
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
