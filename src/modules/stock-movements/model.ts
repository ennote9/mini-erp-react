import type { MovementType, SourceDocumentType } from "../../shared/domain";
import type { StockStyle } from "@/shared/inventoryStyle";

/**
 * Stock Movement entity per docs/01_product_core/02_Domain_Model.md.
 * Factual inventory change event. System of record; not created or edited manually.
 */
export interface StockMovement {
  id: string;
  datetime: string;
  movementType: MovementType;
  itemId: string;
  warehouseId: string;
  style: StockStyle;
  qtyDelta: number;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: string;
  comment?: string;
}
