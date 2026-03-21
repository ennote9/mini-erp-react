import type { WorkspaceModeId } from "../settings/types";

const RANK: Record<WorkspaceModeId, number> = {
  lite: 0,
  standard: 1,
  advanced: 2,
};

export function workspaceModeRank(mode: WorkspaceModeId): number {
  return RANK[mode];
}

/** True when `current` is at least as capable as `min` (same or higher tier). */
export function workspaceModeAtLeast(current: WorkspaceModeId, min: WorkspaceModeId): boolean {
  return RANK[current] >= RANK[min];
}

export const WORKSPACE_MODE_OPTIONS: ReadonlyArray<{
  value: WorkspaceModeId;
  label: string;
  hint: string;
}> = [
  {
    value: "lite",
    label: "Lite",
    hint: "Fewer advanced controls — core buying, selling, and stock.",
  },
  {
    value: "standard",
    label: "Standard",
    hint: "More workflow and operational detail without full inventory depth.",
  },
  {
    value: "advanced",
    label: "Advanced",
    hint: "Full reservations, allocation, diagnostics, and inventory policy as built today.",
  },
];
