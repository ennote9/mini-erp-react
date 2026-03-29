import type { GridApi } from "ag-grid-community";

export type UrlGridSort = {
  colId: string;
  sort: "asc" | "desc";
};

export function readUrlGridSort(
  searchParams: URLSearchParams,
  key = "sort",
): UrlGridSort[] {
  const raw = searchParams.get(key)?.trim() ?? "";
  if (raw === "") return [];
  return raw
    .split(",")
    .map((part) => {
      const [colId, dir] = part.split(":");
      if (!colId || (dir !== "asc" && dir !== "desc")) return null;
      return { colId, sort: dir };
    })
    .filter((entry): entry is UrlGridSort => entry !== null);
}

export function writeUrlGridSort(sortModel: UrlGridSort[], key = "sort"): [string, string][] {
  if (sortModel.length === 0) return [];
  return [[key, sortModel.map((entry) => `${entry.colId}:${entry.sort}`).join(",")]];
}

export function serializeUrlGridSort(sortModel: UrlGridSort[]): string {
  return sortModel.map((entry) => `${entry.colId}:${entry.sort}`).join(",");
}

export function readUrlGridSortValue(
  searchParams: URLSearchParams,
  key = "sort",
): string | null {
  const serialized = serializeUrlGridSort(readUrlGridSort(searchParams, key));
  return serialized === "" ? null : serialized;
}

export function getCurrentGridSort(api: GridApi, skipColIds: string[] = []): UrlGridSort[] {
  return api
    .getColumnState()
    .filter(
      (column) =>
        !!column.sort &&
        (column.sort === "asc" || column.sort === "desc") &&
        !!column.colId &&
        !skipColIds.includes(column.colId),
    )
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((column) => ({
      colId: column.colId!,
      sort: column.sort as "asc" | "desc",
    }));
}

export function applyUrlGridSort(api: GridApi, sortModel: UrlGridSort[]): void {
  api.applyColumnState({
    defaultState: { sort: null },
    state: sortModel.map((entry, index) => ({
      colId: entry.colId,
      sort: entry.sort,
      sortIndex: index,
    })),
  });
}
