export type PrintJobMode = "preview" | "print" | "pdf";

export type PrintJobStatus = "draft" | "queued" | "completed" | "failed";

export interface PrintJob {
  id: string;
  templateId: string;
  itemIds: string[];
  copies: number;
  mode: PrintJobMode;
  status: PrintJobStatus;
  createdAt: string;
  updatedAt: string;
}
