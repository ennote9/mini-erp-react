/**
 * Document-scoped audit events (MVP). Payloads are structured JSON-friendly objects.
 */

export type AuditEntityType = "purchase_order" | "sales_order" | "receipt" | "shipment";

export type AuditEventType =
  | "document_created"
  | "document_saved"
  | "document_confirmed"
  | "document_posted"
  | "document_cancelled"
  | "line_added"
  | "line_removed"
  | "line_qty_changed"
  | "line_unit_price_changed"
  | "zero_price_reason_changed";

export const AUDIT_ACTOR_LOCAL_USER = "local-user";

/** One persisted audit row. */
export type AuditEventRecord = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  eventType: AuditEventType;
  createdAt: string;
  actor: string;
  payload: Record<string, unknown>;
};

export type AuditEventInput = Omit<AuditEventRecord, "id" | "createdAt"> & {
  createdAt?: string;
};
