import type { FactualDocumentStatus, PlanningDocumentStatus } from "@/shared/domain";

const FACTUAL = new Set<string>(["draft", "posted", "reversed", "cancelled"]);
const PLANNING = new Set<string>(["draft", "confirmed", "closed", "cancelled"]);

/**
 * When `undefined`, the list page should not override its status filter from the URL
 * (no `status` query key). Otherwise apply the returned filter (including `"all"` for invalid values).
 */
export function readOptionalFactualStatusFromQuery(
  searchParams: URLSearchParams,
): FactualDocumentStatus | "all" | undefined {
  if (!searchParams.has("status")) return undefined;
  const v = searchParams.get("status")?.trim() ?? "";
  if (v === "" || !FACTUAL.has(v)) return "all";
  return v as FactualDocumentStatus;
}

export function readOptionalPlanningStatusFromQuery(
  searchParams: URLSearchParams,
): PlanningDocumentStatus | "all" | undefined {
  if (!searchParams.has("status")) return undefined;
  const v = searchParams.get("status")?.trim() ?? "";
  if (v === "" || !PLANNING.has(v)) return "all";
  return v as PlanningDocumentStatus;
}

export type ItemLifecycleFilter = "all" | "active" | "inactive";

/** Same pattern as status: only override when `lifecycle` is present in the URL. */
export function readOptionalItemLifecycleFromQuery(
  searchParams: URLSearchParams,
): ItemLifecycleFilter | undefined {
  if (!searchParams.has("lifecycle")) return undefined;
  const v = searchParams.get("lifecycle")?.trim() ?? "";
  if (v === "active" || v === "inactive" || v === "all") return v;
  return "all";
}
