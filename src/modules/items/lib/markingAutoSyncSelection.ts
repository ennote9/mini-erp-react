import type { ItemMarkingRecord } from "../model/itemMarkingRecord";
import type { MarkingAutoSyncScope } from "../model/markingAutoSyncSettings";
import { getSyncProblemKind } from "./markingSyncMismatch";

const RECENT_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves which marking record ids should be included in an automatic FETCH_STATUS run.
 * Deterministic: sorted by id, then capped.
 */
export function collectAutoSyncRecordIds(
  scope: MarkingAutoSyncScope,
  maxRecords: number,
  records: readonly ItemMarkingRecord[],
): string[] {
  const cap = Math.max(0, Math.floor(maxRecords));
  if (cap === 0) return [];

  let filtered: ItemMarkingRecord[];
  switch (scope) {
    case "problem_only":
      filtered = records.filter((r) => getSyncProblemKind(r) != null);
      break;
    case "printed_and_reserved":
      filtered = records.filter((r) => r.status === "PRINTED" || r.status === "RESERVED");
      break;
    case "recent_activity": {
      const now = Date.now();
      filtered = records.filter((r) => {
        const u = new Date(r.updatedAt).getTime();
        if (Number.isFinite(u) && now - u <= RECENT_MS) return true;
        if (r.lastSyncAt) {
          const s = new Date(r.lastSyncAt).getTime();
          if (Number.isFinite(s) && now - s <= RECENT_MS) return true;
        }
        return false;
      });
      break;
    }
    case "custom":
    default:
      filtered = records.filter((r) => getSyncProblemKind(r) != null);
      break;
  }

  return [...filtered]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, cap)
    .map((r) => r.id);
}
