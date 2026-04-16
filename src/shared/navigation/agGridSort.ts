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
