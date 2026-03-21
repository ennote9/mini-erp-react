import type { FactualDocumentStatus } from "../../shared/domain";
import type { ReversalDocumentReasonCode } from "../../shared/reasonCodes";

/**
 * Receipt entity per docs/01_product_core/02_Domain_Model.md.
 * Factual document: factual incoming stock.
 */
export interface Receipt {
  id: string;
  number: string;
  date: string;
  purchaseOrderId: string;
  warehouseId: string;
  status: FactualDocumentStatus;
  comment?: string;
  cancelReasonCode?: string;
  cancelReasonComment?: string;
  /** Set when status is `reversed` (posted receipt was reversed). */
  reversalReasonCode?: ReversalDocumentReasonCode;
  reversalReasonComment?: string;
}

/**
 * Receipt Line per docs/01_product_core/02_Domain_Model.md.
 */
export interface ReceiptLine {
  id: string;
  receiptId: string;
  itemId: string;
  qty: number;
}
