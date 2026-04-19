import type { ItemMarkingRecordKind } from "../model/itemMarkingRecord";
import type { MarkingProviderSettings } from "../model/markingProviderSettings";
import type {
  MarkingExternalAdapter,
  MarkingExternalBatchAckResult,
  MarkingExternalFetchCodeStatusResult,
  MarkingExternalHealthResult,
  MarkingExternalRecordRef,
} from "./markingExternalAdapterTypes";
import { mapBatchAckResponse, mapCodeStatusResponse, metaFrom } from "./httpMarkingExternalMapping";
import { requestJson, trimBase } from "./httpMarkingTransport";

/**
 * Mini ERP HTTP Marking API v1 (default paths under baseUrl).
 *
 * - GET  /health
 * - POST /api/marking/v1/codes/status
 * - POST /api/marking/v1/codes/confirm-used
 * - POST /api/marking/v1/codes/void
 *
 * Real deployments can expose these routes or put a compatible reverse-proxy in front.
 */

const PATH_HEALTH = "/health";
const PATH_STATUS = "/api/marking/v1/codes/status";
const PATH_CONFIRM = "/api/marking/v1/codes/confirm-used";
const PATH_VOID = "/api/marking/v1/codes/void";

function requireConfig(settings: MarkingProviderSettings): { ok: false; message: string } | { ok: true; base: string; apiKey: string } {
  const base = trimBase(settings.baseUrl ?? "");
  if (!base) {
    return { ok: false, message: "not_configured" };
  }
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, message: "api_key_required" };
  }
  return { ok: true, base, apiKey };
}

export function createHttpMarkingExternalAdapter(settings: MarkingProviderSettings): MarkingExternalAdapter {
  const timeoutMs = settings.timeoutMs ?? 15_000;

  return {
    id: settings.providerId || "http",
    displayName: "HTTP marking provider (Mini ERP API v1)",
    isMock: false,

    async healthcheck(): Promise<MarkingExternalHealthResult> {
      const cfg = requireConfig(settings);
      if (!cfg.ok) {
        return { ok: false, message: cfg.message };
      }
      const res = await requestJson({
        baseUrl: cfg.base,
        path: PATH_HEALTH,
        method: "GET",
        apiKey: cfg.apiKey,
        timeoutMs,
        allowNonJson2xx: true,
      });
      if (res.transportError) {
        const hint = res.textSnippet ? ` · ${res.textSnippet.slice(0, 120)}` : "";
        return {
          ok: false,
          message: `${res.transportError}${hint}`,
        };
      }
      if (res.ok && res.status >= 200 && res.status < 300) {
        const msg =
          res.data && typeof res.data === "object"
            ? JSON.stringify(res.data).slice(0, 120)
            : res.textSnippet?.slice(0, 120) ?? `reachable · ${res.status}`;
        return { ok: true, message: msg };
      }
      return { ok: false, message: `http_${res.status}` };
    },

    async fetchCodeStatus(input: {
      recordId: string;
      itemId: string;
      payload: string;
      kind: ItemMarkingRecordKind;
      externalCodeRef?: string;
    }): Promise<MarkingExternalFetchCodeStatusResult> {
      const cfg = requireConfig(settings);
      if (!cfg.ok) {
        return { ok: false, message: cfg.message, syncMeta: undefined };
      }
      const body = {
        recordId: input.recordId,
        itemId: input.itemId,
        payload: input.payload,
        kind: input.kind,
        ...(input.externalCodeRef ? { externalCodeRef: input.externalCodeRef } : {}),
      };
      const res = await requestJson<unknown>({
        baseUrl: cfg.base,
        path: PATH_STATUS,
        method: "POST",
        apiKey: cfg.apiKey,
        timeoutMs,
        body,
      });
      const http = { path: PATH_STATUS, method: "POST", status: res.status };
      if (res.data !== undefined) {
        return mapCodeStatusResponse(res.data, http);
      }
      if (res.transportError) {
        return {
          ok: false,
          message: res.transportError + (res.textSnippet ? `: ${res.textSnippet.slice(0, 200)}` : ""),
          syncMeta: metaFrom(PATH_STATUS, "POST", res.status, res.transportError),
        };
      }
      return {
        ok: false,
        message: "empty_response",
        syncMeta: metaFrom(PATH_STATUS, "POST", res.status, "empty_response"),
      };
    },

    async confirmCodesUsed(records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult> {
      const cfg = requireConfig(settings);
      if (!cfg.ok) {
        return { ok: false, message: cfg.message };
      }
      const body = {
        codes: records.map((r) => ({
          recordId: r.recordId,
          itemId: r.itemId,
          payload: r.payload,
          kind: r.kind,
          ...(r.externalCodeRef ? { externalCodeRef: r.externalCodeRef } : {}),
        })),
      };
      const res = await requestJson<unknown>({
        baseUrl: cfg.base,
        path: PATH_CONFIRM,
        method: "POST",
        apiKey: cfg.apiKey,
        timeoutMs,
        body,
      });
      const http = { path: PATH_CONFIRM, method: "POST", status: res.status };
      if (res.data === undefined) {
        return {
          ok: false,
          message: (res.transportError ?? "request_failed") + (res.textSnippet ? `: ${res.textSnippet.slice(0, 200)}` : ""),
          syncMeta: metaFrom(PATH_CONFIRM, "POST", res.status, res.transportError ?? "request_failed"),
        };
      }
      return mapBatchAckResponse(res.data, "confirm", http);
    },

    async voidCodes(records: readonly MarkingExternalRecordRef[]): Promise<MarkingExternalBatchAckResult> {
      const cfg = requireConfig(settings);
      if (!cfg.ok) {
        return { ok: false, message: cfg.message };
      }
      const body = {
        codes: records.map((r) => ({
          recordId: r.recordId,
          itemId: r.itemId,
          payload: r.payload,
          kind: r.kind,
          ...(r.externalCodeRef ? { externalCodeRef: r.externalCodeRef } : {}),
        })),
      };
      const res = await requestJson<unknown>({
        baseUrl: cfg.base,
        path: PATH_VOID,
        method: "POST",
        apiKey: cfg.apiKey,
        timeoutMs,
        body,
      });
      const http = { path: PATH_VOID, method: "POST", status: res.status };
      if (res.data === undefined) {
        return {
          ok: false,
          message: (res.transportError ?? "request_failed") + (res.textSnippet ? `: ${res.textSnippet.slice(0, 200)}` : ""),
          syncMeta: metaFrom(PATH_VOID, "POST", res.status, res.transportError ?? "request_failed"),
        };
      }
      return mapBatchAckResponse(res.data, "void", http);
    },
  };
}
