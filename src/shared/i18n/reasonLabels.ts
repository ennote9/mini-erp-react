import type { TFunction } from "./resolve";
import {
  CANCEL_DOCUMENT_REASON_LABELS,
  REVERSAL_DOCUMENT_REASON_LABELS,
  ZERO_PRICE_LINE_REASON_LABELS,
  type CancelDocumentReasonCode,
  type ReversalDocumentReasonCode,
  type ZeroPriceLineReasonCode,
} from "@/shared/reasonCodes";

export function translateZeroPriceReason(t: TFunction, code: ZeroPriceLineReasonCode): string {
  return t(`domain.reasons.zeroPrice.${code}`) || ZERO_PRICE_LINE_REASON_LABELS[code];
}

export function translateCancelReason(t: TFunction, code: CancelDocumentReasonCode): string {
  return t(`domain.reasons.cancel.${code}`) || CANCEL_DOCUMENT_REASON_LABELS[code];
}

export function translateReversalReason(t: TFunction, code: ReversalDocumentReasonCode): string {
  return t(`domain.reasons.reversal.${code}`) || REVERSAL_DOCUMENT_REASON_LABELS[code];
}
