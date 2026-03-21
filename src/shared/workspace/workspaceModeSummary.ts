import type { WorkspaceModeId } from "../settings/types";

export type WorkspaceModeSummarySectionId =
  | "navigation"
  | "documents"
  | "inventory"
  | "commercial"
  | "audit";

export const WORKSPACE_MODE_SUMMARY_SECTION_LABELS: Record<WorkspaceModeSummarySectionId, string> = {
  navigation: "Navigation",
  documents: "Documents",
  inventory: "Inventory",
  commercial: "Commercial",
  audit: "Audit & diagnostics",
};

/** Short scan-friendly lines per tier (same product rules as before). */
export const WORKSPACE_MODE_CHANGE_BULLETS: Record<
  WorkspaceModeId,
  Record<WorkspaceModeSummarySectionId, readonly string[]>
> = {
  lite: {
    navigation: ["Brands, Categories, and stock movements off (sidebar + dashboard)."],
    documents: ["Event log & reversal off by default; document workflow settings not listed."],
    inventory: ["No inventory settings; balances show on-hand only; allocation off unless policy needs it."],
    commercial: ["Money rounding only in Settings."],
    audit: ["Data & audit section hidden."],
  },
  standard: {
    navigation: ["Brands, Categories, stock movements, and dashboard links on."],
    documents: ["Document workflow in Settings; event log/reversal follow Documents toggles."],
    inventory: ["Rich stock-balance metrics; allocation stays Advanced unless you override."],
    commercial: ["Extended commercial rules visible."],
    audit: ["Data & audit available."],
  },
  advanced: {
    navigation: ["Full nav, including stock movements."],
    documents: ["Full document surface; still combined with Documents toggles."],
    inventory: ["Inventory policy, allocation, full balance analytics & drill-down."],
    commercial: ["Full commercial settings."],
    audit: ["Diagnostics & audit visible."],
  },
};

export const WORKSPACE_MODE_SUMMARY_ORDER: WorkspaceModeSummarySectionId[] = [
  "navigation",
  "documents",
  "inventory",
  "commercial",
  "audit",
];
