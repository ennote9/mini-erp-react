import type { TFunction } from "./resolve";
import type { PlanningFulfillmentState } from "@/shared/planningFulfillment";
import type { SalesOrderAllocationState } from "@/shared/soAllocation";

export function translatePlanningFulfillmentState(
  t: TFunction,
  state: PlanningFulfillmentState,
): string {
  return t(`doc.fulfillment.poState.${state}`);
}

export function translateSalesOrderAllocationState(
  t: TFunction,
  state: SalesOrderAllocationState,
): string {
  return t(`doc.fulfillment.allocationState.${state}`);
}
