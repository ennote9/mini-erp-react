import type { WorkspaceModeId } from "../settings/types";
import { workspaceModeAtLeast } from "./workspaceMode";

/**
 * UI / settings surfaces gated by workspace mode (phase 1 — visibility-first).
 * Map each to the minimum mode where it should appear.
 */
export type WorkspaceFeatureId =
  | "navBrandsCategories"
  | "navStockMovements"
  | "settingsDocumentsWorkflow"
  | "settingsInventory"
  | "settingsCommercialExtended"
  | "settingsDataAudit"
  | "documentEventLog"
  | "documentReversePosted"
  | "salesOrderAllocateStock"
  | "salesOrderAllocationSummary"
  | "stockBalancesOperationalGrid"
  | "stockBalancesQuickFilters"
  | "stockBalancesDrillDownModal"
  | "dashboardStockMovementsCard";

const MIN_MODE: Record<WorkspaceFeatureId, WorkspaceModeId> = {
  navBrandsCategories: "standard",
  navStockMovements: "standard",
  settingsDocumentsWorkflow: "standard",
  settingsInventory: "advanced",
  settingsCommercialExtended: "standard",
  settingsDataAudit: "standard",
  documentEventLog: "standard",
  documentReversePosted: "standard",
  salesOrderAllocateStock: "advanced",
  salesOrderAllocationSummary: "advanced",
  stockBalancesOperationalGrid: "standard",
  stockBalancesQuickFilters: "standard",
  stockBalancesDrillDownModal: "advanced",
  dashboardStockMovementsCard: "standard",
};

export function isWorkspaceFeatureVisible(
  mode: WorkspaceModeId,
  feature: WorkspaceFeatureId,
): boolean {
  return workspaceModeAtLeast(mode, MIN_MODE[feature]);
}
