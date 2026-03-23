import type { GridOutlinePillTone } from "./GridOutlinePillBadge";
import type { StockBalanceCoverageStatus } from "@/shared/stockBalancesOperationalMetrics";

/** Planning: PO / SO document lifecycle */
export function planningStatusToPillTone(status: string): GridOutlinePillTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "confirmed":
      return "positive";
    case "closed":
      return "muted";
    case "cancelled":
      return "negative";
    default:
      return "neutral";
  }
}

/** Factual: receipt / shipment */
export function factualStatusToPillTone(status: string): GridOutlinePillTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "posted":
      return "positive";
    case "cancelled":
      return "negative";
    case "reversed":
      return "warning";
    default:
      return "neutral";
  }
}

export function stockCoverageToPillTone(s: StockBalanceCoverageStatus): GridOutlinePillTone {
  switch (s) {
    case "covered":
      return "positive";
    case "at_risk":
      return "warning";
    case "short":
      return "negative";
    default:
      return "neutral";
  }
}

/** Stock movement direction / reversal */
export function movementTypeToPillTone(mt: string): GridOutlinePillTone {
  switch (mt) {
    case "receipt":
      return "positive";
    case "shipment":
      return "neutral";
    case "receipt_reversal":
    case "shipment_reversal":
      return "warning";
    default:
      return "neutral";
  }
}

export function activeBooleanToPillTone(isActive: boolean): GridOutlinePillTone {
  return isActive ? "positive" : "muted";
}

/** Master-data carrier type — single restrained tone to avoid noisy grids */
export function carrierTypeLabelPillTone(): GridOutlinePillTone {
  return "neutral";
}
