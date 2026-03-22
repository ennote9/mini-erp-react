/**
 * @deprecated Use `@/shared/appReadModelRevision` — same signal, clearer name.
 * Compatibility re-exports only; prefer `subscribeAppReadModelRevision` / `getAppReadModelRevision` in new code.
 */
export {
  bumpAppReadModelRevision as bumpInventoryDisplayRevision,
  subscribeAppReadModelRevision as subscribeInventoryDisplayRevision,
  getAppReadModelRevision as getInventoryDisplayRevision,
} from "./appReadModelRevision";
