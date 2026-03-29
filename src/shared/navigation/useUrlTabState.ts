import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { replaceQueryParam } from "./returnTo";

type UseUrlTabStateOptions<T extends string> = {
  key?: string;
  defaultValue: T;
  allowedValues: readonly T[];
};

export function useUrlTabState<T extends string>({
  key = "tab",
  defaultValue,
  allowedValues,
}: UseUrlTabStateOptions<T>): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const raw = searchParams.get(key);
    if (raw && allowedValues.includes(raw as T)) return raw as T;
    return defaultValue;
  }, [searchParams, key, allowedValues, defaultValue]);

  const setActiveTab = useCallback(
    (next: T) => {
      replaceQueryParam(searchParams, setSearchParams, key, next, defaultValue);
    },
    [searchParams, setSearchParams, key, defaultValue],
  );

  return [activeTab, setActiveTab];
}
