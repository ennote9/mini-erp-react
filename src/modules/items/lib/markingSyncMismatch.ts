import type { ItemMarkingRecord } from "../model/itemMarkingRecord";
import {
  analyzeMarkingReconciliation,
  buildReconciliationContext,
  mapMismatchKindToLegacy,
  type MarkingIntegrationEffective,
} from "./markingExternalReconciliation";
import { getMarkingRecordLastPrintAudit } from "../markingRecordService";
import { markingProviderSettingsRepository } from "../markingProviderSettingsRepository";
import { buildVoidCountsByBatchRef, buildVoidCountsByItemId } from "./markingTraceabilityReporting";
import { markingRecordRepository } from "../markingRecordRepository";

export type MarkingSyncProblemKind = "never_synced" | "sync_failed" | "mismatch";

export { inferSemanticFromExternalStatus, isNeverSynced, isLastSyncFailed, isSyncMismatch } from "./markingExternalSemantics";

function integrationEffective(): MarkingIntegrationEffective {
  const s = markingProviderSettingsRepository.get();
  if (!s.isEnabled || s.mode === "disabled") return "disabled";
  return s.mode === "mock" ? "mock" : "real";
}

/**
 * Legacy three-bucket sync problem (auto-sync scope, older filters).
 * Prefer {@link analyzeMarkingReconciliation} for Stage 26+ classification.
 */
export function getSyncProblemKind(record: ItemMarkingRecord): MarkingSyncProblemKind | null {
  const records = markingRecordRepository.list();
  const voidByItem = buildVoidCountsByItemId(records);
  const voidByBatch = buildVoidCountsByBatchRef(records);
  const ctx = buildReconciliationContext(
    record,
    Date.now(),
    integrationEffective(),
    getMarkingRecordLastPrintAudit(record.id),
    voidByItem,
    voidByBatch,
  );
  const a = analyzeMarkingReconciliation(record, ctx);
  return mapMismatchKindToLegacy(a.kind);
}
