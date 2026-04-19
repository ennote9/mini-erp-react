import type { MarkingProviderSettings } from "../model/markingProviderSettings";
import type {
  MarkingExternalAdapter,
  MarkingExternalBatchAckResult,
  MarkingExternalFetchCodeStatusResult,
  MarkingExternalHealthResult,
} from "./markingExternalAdapterTypes";

function trimBase(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

/**
 * HTTP-oriented adapter skeleton for a real provider API.
 * Does not pretend to return production truth: code-status API is not wired until credentials/endpoints are known.
 */
export function createHttpMarkingExternalAdapter(settings: MarkingProviderSettings): MarkingExternalAdapter {
  const timeoutMs = settings.timeoutMs ?? 15_000;

  return {
    id: settings.providerId || "http",
    displayName: "HTTP marking provider (skeleton)",
    isMock: false,

    async healthcheck(): Promise<MarkingExternalHealthResult> {
      const base = trimBase(settings.baseUrl);
      if (!base) {
        return { ok: false, message: "not_configured" };
      }
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const url = `${base}/health`;
        const res = await fetch(url, {
          method: "GET",
          signal: ctrl.signal,
          headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : undefined,
        });
        clearTimeout(timer);
        if (res.ok) {
          return { ok: true, message: `reachable · ${res.status}` };
        }
        return { ok: false, message: `http_${res.status}` };
      } catch (e) {
        clearTimeout(timer);
        const name = e instanceof Error ? e.name : "";
        const msg = e instanceof Error ? e.message : String(e);
        if (name === "AbortError") return { ok: false, message: "timeout" };
        return { ok: false, message: msg };
      }
    },

    async fetchCodeStatus(): Promise<MarkingExternalFetchCodeStatusResult> {
      const base = trimBase(settings.baseUrl);
      if (!base) {
        return { ok: false, message: "not_configured" };
      }
      return {
        ok: false,
        message: "real_provider_api_not_implemented",
      };
    },

    async confirmCodesUsed(): Promise<MarkingExternalBatchAckResult> {
      const base = trimBase(settings.baseUrl);
      if (!base) return { ok: false, message: "not_configured" };
      return { ok: false, message: "real_provider_api_not_implemented" };
    },

    async voidCodes(): Promise<MarkingExternalBatchAckResult> {
      const base = trimBase(settings.baseUrl);
      if (!base) return { ok: false, message: "not_configured" };
      return { ok: false, message: "real_provider_api_not_implemented" };
    },
  };
}
