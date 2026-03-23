import { useSyncExternalStore } from "react";
import {
  getAppReadModelRevision,
  subscribeAppReadModelRevision,
} from "@/shared/appReadModelRevision";

/** Subscribe to the shared read-model revision (master inventory blocks, hub summaries, etc.). */
export function useAppReadModelRevision(): number {
  return useSyncExternalStore(
    subscribeAppReadModelRevision,
    getAppReadModelRevision,
    getAppReadModelRevision,
  );
}
