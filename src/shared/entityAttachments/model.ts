export type EntityAttachmentType = "customer" | "agreement" | "order" | "shipment";

export interface EntityAttachment {
  id: string;
  entityType: EntityAttachmentType;
  entityId: string;
  fileName: string;
  storageRef: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
  comment?: string;
}

