/**
 * Central reconciliation: mismatch classification, severity, recommended actions.
 * Does not mutate lifecycle or call providers — UI/services apply actions explicitly.
 */
import type { ItemMarkingRecord, ItemMarkingRecordStatus } from "../model/itemMarkingRecord";
import type { ItemMarkingRecordAuditEntry } from "../model/itemMarkingRecordAudit";
import {
  MARKING_STALE_PRINTED_MS,
  MARKING_STALE_RESERVED_MS,
  computeMarkingProblems,
  type MarkingProblemInfo,
} from "./markingTraceabilityReporting";
import { inferSemanticFromExternalStatus, isSyncMismatch } from "./markingExternalSemantics";

/** Snapshot considered stale if internal row changed this long after last successful sync. */
export const MARKING_STALE_EXTERNAL_SNAPSHOT_MS = 24 * 60 * 60 * 1000;

export type MarkingIntegrationEffective = "disabled" | "mock" | "real";

export type MarkingMismatchKind =
  | "none"
  | "never_synced"
  | "sync_failed"
  | "external_missing"
  | "external_unknown"
  | "status_mismatch"
  | "printed_not_confirmed_externally"
  | "used_internally_but_not_confirmed_externally"
  | "void_internally_but_active_externally"
  | "reserved_too_long"
  | "printed_too_long_without_used"
  | "provider_conflict"
  | "stale_external_snapshot"
  /** Outbound sync is off — differentiate from unexplained provider failure. */
  | "provider_unavailable";

export type MarkingMismatchSeverity = "info" | "warning" | "error";

export type MarkingReconciliationActionId =
  | "sync_now"
  | "retry_sync"
  | "confirm_used_externally"
  | "void_externally"
  | "release_internally"
  | "mark_used_internally"
  | "void_internally"
  | "open_print_context"
  | "open_traceability"
  | "open_reconciliation"
  | "open_sync_console"
  | "inspect_manually";

export type MarkingReconciliationContext = {
  nowMs: number;
  integration: MarkingIntegrationEffective;
  /** Latest print audit (to PRINTED with job), if any. */
  lastPrintAudit?: ItemMarkingRecordAuditEntry;
  /** For stale / anomaly hints; optional. */
  problems?: MarkingProblemInfo;
};

export type MarkingReconciliationAnalysis = {
  kind: MarkingMismatchKind;
  severity: MarkingMismatchSeverity;
  /** Stable key for i18n: `master.markingReconciliation.explanation.${explanationKey}` */
  explanationKey: string;
  recommendedActionIds: MarkingReconciliationActionId[];
  needsAttention: boolean;
};

const emptyProblems: MarkingProblemInfo = { kinds: [], hasProblem: false };

function severityForKind(kind: MarkingMismatchKind, integration: MarkingIntegrationEffective): MarkingMismatchSeverity {
  switch (kind) {
    case "none":
      return "info";
    case "provider_unavailable":
    case "never_synced":
      return integration === "disabled" ? "info" : "warning";
    case "sync_failed":
    case "void_internally_but_active_externally":
    case "used_internally_but_not_confirmed_externally":
    case "provider_conflict":
      return "error";
    default:
      return "warning";
  }
}

function baseRecommendations(
  kind: MarkingMismatchKind,
  _record: ItemMarkingRecord,
  ctx: MarkingReconciliationContext,
): MarkingReconciliationActionId[] {
  const { integration, lastPrintAudit } = ctx;
  const out: MarkingReconciliationActionId[] = [];

  const canOutbound = integration !== "disabled";

  if (kind === "none") {
    return ["open_traceability", "open_reconciliation"];
  }

  if (kind === "provider_unavailable") {
    out.push("inspect_manually", "open_sync_console", "open_reconciliation");
    return [...new Set(out)];
  }

  if (kind === "never_synced" || kind === "sync_failed" || kind === "stale_external_snapshot") {
    if (canOutbound) out.push(kind === "sync_failed" ? "retry_sync" : "sync_now");
    else out.push("inspect_manually");
  }

  if (kind === "external_missing" || kind === "external_unknown" || kind === "printed_not_confirmed_externally") {
    if (canOutbound) out.push("sync_now", "confirm_used_externally", "void_externally");
    out.push("mark_used_internally", "void_internally", "inspect_manually");
  }

  if (kind === "used_internally_but_not_confirmed_externally") {
    if (canOutbound) out.push("confirm_used_externally", "sync_now");
    out.push("inspect_manually", "open_traceability");
  }

  if (kind === "void_internally_but_active_externally") {
    if (canOutbound) out.push("void_externally", "sync_now");
    out.push("inspect_manually");
  }

  if (kind === "status_mismatch" || kind === "provider_conflict") {
    if (canOutbound) out.push("sync_now");
    out.push("inspect_manually", "open_traceability", "open_reconciliation");
  }

  if (kind === "reserved_too_long") {
    out.push("release_internally", "inspect_manually", "open_traceability");
    if (canOutbound) out.push("sync_now");
  }

  if (kind === "printed_too_long_without_used") {
    out.push("mark_used_internally", "void_internally", "inspect_manually", "open_traceability");
    if (canOutbound) out.push("confirm_used_externally", "void_externally", "sync_now");
  }

  if (lastPrintAudit?.printJobId) {
    out.push("open_print_context");
  }

  out.push("open_reconciliation", "open_sync_console");

  return [...new Set(out)];
}

function explanationKeyFor(kind: MarkingMismatchKind): string {
  return kind;
}

/**
 * Full deterministic classification for one marking record.
 */
export function analyzeMarkingReconciliation(record: ItemMarkingRecord, ctx: MarkingReconciliationContext): MarkingReconciliationAnalysis {
  const { integration } = ctx;
  const problems = ctx.problems ?? emptyProblems;
  const ext = inferSemanticFromExternalStatus(record.externalStatus);
  const lastSyncMs = record.lastSyncAt ? Date.parse(record.lastSyncAt) : NaN;
  const updatedMs = Date.parse(record.updatedAt);

  const outboundOff = integration === "disabled";

  if (outboundOff && !record.lastSyncAt) {
    return {
      kind: "provider_unavailable",
      severity: "info",
      explanationKey: "provider_unavailable",
      recommendedActionIds: baseRecommendations("provider_unavailable", record, ctx),
      needsAttention: true,
    };
  }

  if (!record.lastSyncAt) {
    const kind: MarkingMismatchKind = "never_synced";
    return {
      kind,
      severity: severityForKind(kind, integration),
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (record.lastSyncStatus === "FAILED") {
    const kind: MarkingMismatchKind = "sync_failed";
    return {
      kind,
      severity: "error",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  // Strong semantic conflicts (successful sync path assumed below)
  if (record.status === "VOID" && ext !== "VOID" && ext !== "UNKNOWN") {
    const kind: MarkingMismatchKind = "void_internally_but_active_externally";
    return {
      kind,
      severity: "error",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (record.status === "USED" && ext !== "USED" && ext !== "UNKNOWN") {
    const kind: MarkingMismatchKind = "used_internally_but_not_confirmed_externally";
    return {
      kind,
      severity: "error",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (record.status === "USED" && ext === "UNKNOWN") {
    const kind: MarkingMismatchKind = "external_unknown";
    return {
      kind,
      severity: "warning",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (record.status === "PRINTED") {
    const extTrim = record.externalStatus?.trim() ?? "";
    if (!extTrim && record.lastSyncStatus === "SUCCESS") {
      const kind: MarkingMismatchKind = "external_missing";
      return {
        kind,
        severity: "warning",
        explanationKey: explanationKeyFor(kind),
        recommendedActionIds: baseRecommendations(kind, record, ctx),
        needsAttention: true,
      };
    }
    if (ext === "UNKNOWN") {
      const kind: MarkingMismatchKind = "external_unknown";
      return {
        kind,
        severity: "warning",
        explanationKey: explanationKeyFor(kind),
        recommendedActionIds: baseRecommendations(kind, record, ctx),
        needsAttention: true,
      };
    }
    if (ext !== "PRINTED") {
      const kind: MarkingMismatchKind = "printed_not_confirmed_externally";
      return {
        kind,
        severity: "warning",
        explanationKey: explanationKeyFor(kind),
        recommendedActionIds: baseRecommendations(kind, record, ctx),
        needsAttention: true,
      };
    }
  }

  if (
    record.lastSyncAt &&
    record.lastSyncStatus === "SUCCESS" &&
    Number.isFinite(updatedMs) &&
    Number.isFinite(lastSyncMs) &&
    updatedMs > lastSyncMs + MARKING_STALE_EXTERNAL_SNAPSHOT_MS
  ) {
    const kind: MarkingMismatchKind = "stale_external_snapshot";
    return {
      kind,
      severity: "warning",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (problems.kinds.includes("stale_reserved")) {
    const kind: MarkingMismatchKind = "reserved_too_long";
    return {
      kind,
      severity: "warning",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (problems.kinds.includes("stale_printed")) {
    const kind: MarkingMismatchKind = "printed_too_long_without_used";
    return {
      kind,
      severity: "warning",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (record.status === "AVAILABLE" && (ext === "USED" || ext === "PRINTED" || ext === "RESERVED")) {
    const kind: MarkingMismatchKind = "provider_conflict";
    return {
      kind,
      severity: "error",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  if (isSyncMismatch(record)) {
    const kind: MarkingMismatchKind = "status_mismatch";
    return {
      kind,
      severity: "warning",
      explanationKey: explanationKeyFor(kind),
      recommendedActionIds: baseRecommendations(kind, record, ctx),
      needsAttention: true,
    };
  }

  return {
    kind: "none",
    severity: "info",
    explanationKey: "none",
    recommendedActionIds: baseRecommendations("none", record, ctx),
    needsAttention: false,
  };
}

/** Build context fields shared across list/detail views. */
export function buildReconciliationContext(
  record: ItemMarkingRecord,
  nowMs: number,
  integration: MarkingIntegrationEffective,
  lastPrintAudit: ItemMarkingRecordAuditEntry | undefined,
  voidByItem: Map<string, { total: number; voids: number }>,
  voidByBatchRef: Map<string, number>,
): MarkingReconciliationContext {
  const problems = computeMarkingProblems(record, nowMs, voidByItem, voidByBatchRef, {
    staleReservedMs: MARKING_STALE_RESERVED_MS,
    stalePrintedMs: MARKING_STALE_PRINTED_MS,
  });
  return { nowMs, integration, lastPrintAudit, problems };
}

export type LegacySyncProblemKind = "never_synced" | "sync_failed" | "mismatch";

/** Maps rich classification to the legacy three-bucket model (auto-sync, old UI). */
export function mapMismatchKindToLegacy(kind: MarkingMismatchKind): LegacySyncProblemKind | null {
  if (kind === "none" || kind === "provider_unavailable") return null;
  if (kind === "never_synced") return "never_synced";
  if (kind === "sync_failed") return "sync_failed";
  return "mismatch";
}

/**
 * Which bulk reconciliation actions apply to a record (central eligibility).
 */
export function isActionEligibleForRecord(
  action: MarkingReconciliationActionId,
  record: ItemMarkingRecord,
  analysis: MarkingReconciliationAnalysis,
): boolean {
  if (analysis.kind === "none" && action !== "sync_now") {
    return action === "open_traceability" || action === "open_reconciliation" || action === "open_sync_console";
  }
  switch (action) {
    case "release_internally":
      return record.status === "RESERVED";
    case "mark_used_internally":
      return record.status === "PRINTED";
    case "void_internally":
      return record.status === "RESERVED" || record.status === "PRINTED";
    case "confirm_used_externally":
      return (
        analysis.kind === "used_internally_but_not_confirmed_externally" ||
        analysis.kind === "printed_not_confirmed_externally" ||
        (analysis.kind === "external_unknown" && record.status === "PRINTED") ||
        (analysis.kind === "external_missing" && record.status === "PRINTED")
      );
    case "void_externally":
      return (
        (record.status === "RESERVED" || record.status === "PRINTED" || record.status === "USED") &&
        analysis.kind !== "none" &&
        analysis.kind !== "provider_unavailable" &&
        analysis.needsAttention
      );
    case "sync_now":
    case "retry_sync":
      return true;
    default:
      return true;
  }
}

export function partitionBulkByAction(
  ids: readonly string[],
  getRecord: (id: string) => ItemMarkingRecord | undefined,
  getAnalysis: (record: ItemMarkingRecord) => MarkingReconciliationAnalysis,
  action: MarkingReconciliationActionId,
): { eligible: string[]; skipped: string[] } {
  const eligible: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const r = getRecord(id);
    if (!r) {
      skipped.push(id);
      continue;
    }
    const a = getAnalysis(r);
    if (isActionEligibleForRecord(action, r, a)) eligible.push(id);
    else skipped.push(id);
  }
  return { eligible, skipped };
}

/** Human-readable internal vs external expectation (for detail pane). */
export function describeExpectedVersusActual(record: ItemMarkingRecord): { internal: ItemMarkingRecordStatus; external: ItemMarkingRecordStatus | "UNKNOWN" } {
  return { internal: record.status, external: inferSemanticFromExternalStatus(record.externalStatus) };
}

export type ReconciliationSummaryMetrics = {
  attentionTotal: number;
  criticalCount: number;
  neverSynced: number;
  syncFailed: number;
  staleReserved: number;
  stalePrinted: number;
  confirmationGaps: number;
};

export function summarizeReconciliationAnalyses(
  analyses: ReadonlyArray<{ recordId: string; analysis: MarkingReconciliationAnalysis }>,
): ReconciliationSummaryMetrics {
  const m: ReconciliationSummaryMetrics = {
    attentionTotal: 0,
    criticalCount: 0,
    neverSynced: 0,
    syncFailed: 0,
    staleReserved: 0,
    stalePrinted: 0,
    confirmationGaps: 0,
  };
  for (const { analysis: a } of analyses) {
    if (!a.needsAttention) continue;
    m.attentionTotal++;
    if (a.severity === "error") m.criticalCount++;
    if (a.kind === "never_synced") m.neverSynced++;
    if (a.kind === "sync_failed") m.syncFailed++;
    if (a.kind === "reserved_too_long") m.staleReserved++;
    if (a.kind === "printed_too_long_without_used") m.stalePrinted++;
    if (a.kind === "used_internally_but_not_confirmed_externally" || a.kind === "printed_not_confirmed_externally") {
      m.confirmationGaps++;
    }
  }
  return m;
}
