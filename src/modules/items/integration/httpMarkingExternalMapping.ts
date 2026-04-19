/**
 * Maps Mini ERP HTTP Marking API v1 responses into adapter result types.
 * Provider-specific field names stay here — UI and sync service see normalized strings only.
 */

import type {
  MarkingExternalBatchAckResult,
  MarkingExternalFetchCodeStatusResult,
  MarkingExternalPerRecordOutcome,
  MarkingExternalSyncCallMeta,
} from "./markingExternalAdapterTypes";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const x = o[k];
    if (typeof x === "string" && x.length) return x;
  }
  return undefined;
}

function pickBool(o: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const k of keys) {
    const x = o[k];
    if (typeof x === "boolean") return x;
  }
  return undefined;
}

export function metaFrom(path: string, method: string, status: number, errorCode?: string): MarkingExternalSyncCallMeta {
  return { method, path, httpStatus: status, errorCode };
}

/** Normalize external status label (uppercase snake free-form). */
export function normalizeExternalStatusLabel(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw.trim();
}

/**
 * Expected JSON shapes (v1):
 * - { success: true, data: { externalStatus, externalCodeRef, message } }
 * - { ok: true, externalStatus, externalCodeRef, message }
 * - { success: false, errorCode, message }
 */
export function mapCodeStatusResponse(
  data: unknown,
  http: { path: string; method: string; status: number },
): MarkingExternalFetchCodeStatusResult {
  const root = asObj(data);
  if (!root) {
    return {
      ok: false,
      message: "empty_response",
      syncMeta: metaFrom(http.path, http.method, http.status, "empty_response"),
    };
  }

  const nested = asObj(root.data) ?? asObj(root.result) ?? root;
  const success =
    pickBool(root, ["success", "ok"]) ??
    pickBool(nested, ["success", "ok"]) ??
    (pickString(nested, ["externalStatus", "status"]) != null);

  if (success === false || root.error || nested.error) {
    const msg =
      pickString(root, ["message", "error"]) ??
      pickString(asObj(root.error) ?? {}, ["message"]) ??
      "provider_error";
    const code = pickString(root, ["errorCode", "code"]) ?? pickString(nested, ["errorCode", "code"]) ?? "provider_error";
    return {
      ok: false,
      message: msg,
      syncMeta: metaFrom(http.path, http.method, http.status, code),
    };
  }

  const externalStatus =
    normalizeExternalStatusLabel(
      pickString(nested, ["externalStatus", "status", "state", "registryStatus"]) ??
        pickString(root, ["externalStatus", "status"]),
    );
  const externalCodeRef = pickString(nested, ["externalCodeRef", "codeRef", "externalId", "id"]) ?? pickString(root, ["externalCodeRef"]);

  if (externalStatus != null) {
    return {
      ok: true,
      externalStatus,
      externalCodeRef,
      message: pickString(nested, ["message"]) ?? pickString(root, ["message"]),
      syncMeta: metaFrom(http.path, http.method, http.status),
    };
  }

  return {
    ok: false,
    message: pickString(root, ["message"]) ?? "status_missing",
    syncMeta: metaFrom(http.path, http.method, http.status, "status_missing"),
  };
}

export type BatchOp = "confirm" | "void";

/**
 * Expected JSON:
 * - { success, externalReference?, results: [{ recordId, ok|success, message?, errorCode? }] }
 * - { ok, batchId, items: [...] }
 */
export function mapBatchAckResponse(data: unknown, op: BatchOp, http: { path: string; method: string; status: number }): MarkingExternalBatchAckResult {
  const root = asObj(data);
  if (!root) {
    return {
      ok: false,
      message: "empty_response",
      syncMeta: metaFrom(http.path, http.method, http.status, "empty_response"),
    };
  }

  const successTop = pickBool(root, ["success", "ok"]);
  const extRef =
    pickString(root, ["externalReference", "batchId", "requestId", "operationId"]) ?? pickString(asObj(root.data) ?? {}, ["externalReference"]);

  const arrRaw = root.results ?? root.items ?? (asObj(root.data)?.results as unknown) ?? (asObj(root.data)?.items as unknown);
  const arr = Array.isArray(arrRaw) ? arrRaw : null;

  const perRecord: MarkingExternalPerRecordOutcome[] = [];
  if (arr) {
    for (const row of arr) {
      const o = asObj(row);
      if (!o) continue;
      const recordId = pickString(o, ["recordId", "id", "markingRecordId"]);
      if (!recordId) continue;
      const rowOk = pickBool(o, ["ok", "success"]);
      const msg = pickString(o, ["message", "error"]) ?? undefined;
      const errC = pickString(o, ["errorCode", "code"]);
      perRecord.push({
        recordId,
        ok: rowOk === true,
        message: msg,
        syncMeta:
          rowOk === false
            ? metaFrom(http.path, http.method, http.status, errC ?? "record_failed")
            : metaFrom(http.path, http.method, http.status),
      });
    }
  }

  if (perRecord.length > 0) {
    const okCount = perRecord.filter((p) => p.ok).length;
    const allOk = okCount === perRecord.length;
    const noneOk = okCount === 0;
    return {
      ok: allOk,
      message: noneOk ? (pickString(root, ["message"]) ?? `${op}_failed`) : allOk ? pickString(root, ["message"]) ?? `${op}_ok` : `${op}_partial`,
      externalReference: extRef,
      perRecord,
      syncMeta: metaFrom(http.path, http.method, http.status),
    };
  }

  if (successTop === false) {
    return {
      ok: false,
      message: pickString(root, ["message", "error"]) ?? `${op}_failed`,
      externalReference: extRef,
      syncMeta: metaFrom(http.path, http.method, http.status, pickString(root, ["errorCode", "code"]) ?? "batch_failed"),
    };
  }

  if (successTop === true) {
    return {
      ok: true,
      message: pickString(root, ["message"]) ?? `${op}_ok`,
      externalReference: extRef,
      syncMeta: metaFrom(http.path, http.method, http.status),
    };
  }

  return {
    ok: false,
    message: pickString(root, ["message"]) ?? "unrecognized_batch_response",
    syncMeta: metaFrom(http.path, http.method, http.status, "unrecognized_batch_response"),
  };
}
