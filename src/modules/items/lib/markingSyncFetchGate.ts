/**
 * Mutual exclusion for {@link syncMarkingRecords} (FETCH_STATUS path).
 * - Manual runs wait in a FIFO queue when another sync is active.
 * - Auto runs skip immediately when anything is active (no queue).
 */
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

const waitQueue: Array<() => void> = [];
let depth = 0;

let activeTrigger: "manual" | "auto" | null = null;

export function getActiveMarkingFetchSyncTrigger(): "manual" | "auto" | null {
  return activeTrigger;
}

export function setActiveMarkingFetchSyncTrigger(next: "manual" | "auto" | null): void {
  activeTrigger = next;
  bumpAppReadModelRevision();
}

/**
 * Returns true if the auto slot was acquired; false if another run is in progress.
 */
export function tryMarkingFetchSyncAuto(): boolean {
  if (depth > 0) return false;
  depth += 1;
  return true;
}

export function endMarkingFetchSyncAuto(): void {
  depth -= 1;
  drainQueue();
}

function drainQueue(): void {
  const next = waitQueue.shift();
  if (next) next();
}

export async function enterMarkingFetchSyncManual(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (depth === 0) {
      depth += 1;
      resolve();
    } else {
      waitQueue.push(() => {
        depth += 1;
        resolve();
      });
    }
  });
}

export function endMarkingFetchSyncManual(): void {
  depth -= 1;
  drainQueue();
}
