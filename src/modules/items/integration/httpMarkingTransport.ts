/**
 * Shared fetch helper for HTTP marking provider — single place for timeout, headers, and error shaping.
 */

export type HttpMarkingRequestResult<T = unknown> = {
  ok: boolean;
  status: number;
  path: string;
  method: string;
  /** Parsed JSON when response looked like JSON. */
  data?: T;
  /** Raw text (trimmed, capped) when not JSON or for diagnostics. */
  textSnippet?: string;
  /** Transport-level error (network, timeout, invalid json when required). */
  transportError?: string;
};

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  const b = trimBase(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * JSON request with Bearer auth, AbortController timeout, unified error handling.
 * Does not log or persist secrets.
 */
export async function requestJson<T = unknown>(opts: {
  baseUrl: string;
  path: string;
  method: "GET" | "POST";
  apiKey: string | undefined;
  timeoutMs: number;
  body?: unknown;
  /** When true, non-JSON 2xx still returns ok with textSnippet. */
  allowNonJson2xx?: boolean;
}): Promise<HttpMarkingRequestResult<T>> {
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = joinUrl(opts.baseUrl, path);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.apiKey) {
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }
  let bodyStr: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(opts.body);
  }

  try {
    const res = await fetch(url, {
      method: opts.method,
      signal: ctrl.signal,
      headers,
      body: bodyStr,
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    const rawText = await res.text();
    const snippet = rawText.length > 800 ? `${rawText.slice(0, 800)}…` : rawText;

    if (res.ok) {
      if (!rawText.trim()) {
        return {
          ok: true,
          status: res.status,
          path,
          method: opts.method,
          data: undefined,
          textSnippet: undefined,
        };
      }
      if (ct.includes("json") || rawText.trimStart().startsWith("{") || rawText.trimStart().startsWith("[")) {
        const parsed = safeJsonParse(rawText);
        if (parsed.ok) {
          return {
            ok: true,
            status: res.status,
            path,
            method: opts.method,
            data: parsed.value as T,
            textSnippet: snippet,
          };
        }
        if (opts.allowNonJson2xx) {
          return {
            ok: true,
            status: res.status,
            path,
            method: opts.method,
            textSnippet: snippet,
          };
        }
        return {
          ok: false,
          status: res.status,
          path,
          method: opts.method,
          transportError: "invalid_json",
          textSnippet: snippet,
        };
      }
      if (opts.allowNonJson2xx) {
        return {
          ok: true,
          status: res.status,
          path,
          method: opts.method,
          textSnippet: snippet,
        };
      }
      return {
        ok: false,
        status: res.status,
        path,
        method: opts.method,
        transportError: "unexpected_non_json",
        textSnippet: snippet,
      };
    }

    let errCode: string | undefined;
    let errMsg: string | undefined;
    let parsedErr: unknown;
    const pj = safeJsonParse(rawText);
    if (pj.ok) {
      parsedErr = pj.value;
      if (pj.value && typeof pj.value === "object") {
        const o = pj.value as Record<string, unknown>;
        errCode = typeof o.errorCode === "string" ? o.errorCode : typeof o.code === "string" ? o.code : undefined;
        errMsg = typeof o.message === "string" ? o.message : typeof o.error === "string" ? o.error : undefined;
      }
    }
    return {
      ok: false,
      status: res.status,
      path,
      method: opts.method,
      data: parsedErr as T | undefined,
      transportError: errCode ?? `http_${res.status}`,
      textSnippet: errMsg ?? snippet,
    };
  } catch (e) {
    clearTimeout(timer);
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "AbortError") {
      return {
        ok: false,
        status: 0,
        path,
        method: opts.method,
        transportError: "timeout",
      };
    }
    return {
      ok: false,
      status: 0,
      path,
      method: opts.method,
      transportError: "network_error",
      textSnippet: msg,
    };
  }
}

export { trimBase, joinUrl };
