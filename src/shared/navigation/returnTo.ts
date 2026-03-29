import type { SetURLSearchParams } from "react-router-dom";

function isValidInternalReturnTo(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  return true;
}

export function buildReturnToValue(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function readReturnToParam(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("returnTo");
  if (!isValidInternalReturnTo(raw)) return null;
  return raw;
}

export function appendReturnTo(path: string, returnTo: string | null | undefined): string {
  if (!isValidInternalReturnTo(returnTo)) return path;
  const url = new URL(path, "http://local.invalid");
  url.searchParams.set("returnTo", returnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function withUpdatedQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | null | undefined,
  defaultValue?: string,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  const normalized = value?.trim() ?? "";
  if (normalized === "" || (defaultValue !== undefined && normalized === defaultValue)) {
    next.delete(key);
  } else {
    next.set(key, normalized);
  }
  return next;
}

export function replaceQueryParam(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  key: string,
  value: string | null | undefined,
  defaultValue?: string,
): void {
  setSearchParams(withUpdatedQueryParam(searchParams, key, value, defaultValue), {
    replace: true,
  });
}

export function buildNavigationStateKey(
  pathname: string,
  searchParams: URLSearchParams | string,
  ignoredKeys: string[] = [],
): string {
  const input =
    typeof searchParams === "string" ? new URLSearchParams(searchParams) : new URLSearchParams(searchParams);
  const entries = [...input.entries()]
    .filter(([key]) => !ignoredKeys.includes(key))
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) return aValue.localeCompare(bValue);
      return aKey.localeCompare(bKey);
    });
  const normalized = new URLSearchParams(entries).toString();
  return normalized === "" ? pathname : `${pathname}?${normalized}`;
}
