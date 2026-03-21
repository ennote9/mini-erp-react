import type { ProfileOverridesState, WorkspaceModeId } from "../settings/types";
import type { WorkspaceFeatureId } from "./featureVisibility";
import { isWorkspaceFeatureVisible } from "./featureVisibility";

export type ProfileOverrideKey = keyof ProfileOverridesState;

export const NULL_PROFILE_OVERRIDES: ProfileOverridesState = {
  documentEventLog: null,
  reverseDocumentActions: null,
  stockMovementsNav: null,
  advancedStockBalanceAnalytics: null,
  stockBalanceSourceModal: null,
  allocationControls: null,
};

/** Workspace features each override key drives (single toggle may map to several surfaces). */
export const PROFILE_OVERRIDE_FEATURES: Record<ProfileOverrideKey, readonly WorkspaceFeatureId[]> = {
  documentEventLog: ["documentEventLog"],
  reverseDocumentActions: ["documentReversePosted"],
  stockMovementsNav: ["navStockMovements", "dashboardStockMovementsCard"],
  advancedStockBalanceAnalytics: ["stockBalancesOperationalGrid", "stockBalancesQuickFilters"],
  stockBalanceSourceModal: ["stockBalancesDrillDownModal"],
  allocationControls: ["salesOrderAllocateStock", "salesOrderAllocationSummary"],
};

const FEATURE_TO_OVERRIDE_KEY: Partial<Record<WorkspaceFeatureId, ProfileOverrideKey>> = (() => {
  const m: Partial<Record<WorkspaceFeatureId, ProfileOverrideKey>> = {};
  for (const [key, feats] of Object.entries(PROFILE_OVERRIDE_FEATURES) as [
    ProfileOverrideKey,
    readonly WorkspaceFeatureId[],
  ][]) {
    for (const f of feats) m[f] = key;
  }
  return m;
})();

export type WorkspaceFeatureContext = {
  requireReservationBeforeShipment?: boolean;
};

/** Baseline for an override row: workspace tier, plus reservation policy forcing allocation on. */
export function modeDefaultForProfileOverride(
  mode: WorkspaceModeId,
  key: ProfileOverrideKey,
  ctx?: WorkspaceFeatureContext,
): boolean {
  if (key === "allocationControls" && ctx?.requireReservationBeforeShipment) {
    return true;
  }
  const [first] = PROFILE_OVERRIDE_FEATURES[key];
  return isWorkspaceFeatureVisible(mode, first);
}

/**
 * Effective visibility for a workspace feature: profile override wins when set; otherwise mode default
 * and the reservation-before-shipment escape for allocation features.
 */
export function getEffectiveWorkspaceFeatureEnabled(
  mode: WorkspaceModeId,
  overrides: ProfileOverridesState,
  feature: WorkspaceFeatureId,
  ctx?: WorkspaceFeatureContext,
): boolean {
  const overrideKey = FEATURE_TO_OVERRIDE_KEY[feature];
  if (overrideKey !== undefined) {
    const o = overrides[overrideKey];
    if (o !== null && o !== undefined) {
      return o;
    }
  }

  if (
    (feature === "salesOrderAllocateStock" || feature === "salesOrderAllocationSummary") &&
    ctx?.requireReservationBeforeShipment
  ) {
    return true;
  }

  return isWorkspaceFeatureVisible(mode, feature);
}

export function getEffectiveProfileOverride(
  mode: WorkspaceModeId,
  overrides: ProfileOverridesState,
  key: ProfileOverrideKey,
  ctx?: WorkspaceFeatureContext,
): boolean {
  return getEffectiveWorkspaceFeatureEnabled(mode, overrides, PROFILE_OVERRIDE_FEATURES[key][0], ctx);
}

/** After user toggles a checkbox to `wantChecked`, return new overrides (null when matching profile default). */
export function profileOverridesAfterToggle(
  mode: WorkspaceModeId,
  current: ProfileOverridesState,
  key: ProfileOverrideKey,
  wantChecked: boolean,
  ctx?: WorkspaceFeatureContext,
): ProfileOverridesState {
  const def = modeDefaultForProfileOverride(mode, key, ctx);
  const next: ProfileOverridesState = { ...current };
  if (wantChecked === def) {
    next[key] = null;
  } else {
    next[key] = wantChecked;
  }
  return next;
}

export function profileOverridesHasAnyCustom(overrides: ProfileOverridesState): boolean {
  return (Object.keys(overrides) as ProfileOverrideKey[]).some((k) => overrides[k] !== null);
}

export function profileOverrideCustomCount(overrides: ProfileOverridesState): number {
  return (Object.keys(overrides) as ProfileOverrideKey[]).filter((k) => overrides[k] !== null).length;
}
