/**
 * Document and movement status types per docs/01_product_core/03_Statuses_and_Rules.md.
 * Internal values are lowercase. MVP only — no Partially Received, Reopened, Reversed, etc.
 */

/** Planning documents: Purchase Order, Sales Order. Internal values lowercase. */
export type PlanningDocumentStatus =
  | "draft"
  | "confirmed"
  | "closed"
  | "cancelled";

/** Factual documents: Receipt, Shipment. Internal values lowercase. */
export type FactualDocumentStatus = "draft" | "posted" | "cancelled" | "reversed";

/**
 * Type of inventory movement: receipt = incoming, shipment = outgoing.
 * *_reversal = compensating movement for a posted document reversal (explicit audit trail).
 * Separate domain concept from SourceDocumentType.
 */
export type MovementType =
  | "receipt"
  | "shipment"
  | "receipt_reversal"
  | "shipment_reversal";

/**
 * Type of the document that caused a stock movement.
 * Separate domain concept from MovementType; same value set in MVP.
 */
export type SourceDocumentType = "receipt" | "shipment";
