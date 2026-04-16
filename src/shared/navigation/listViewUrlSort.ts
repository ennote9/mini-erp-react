export type ListViewUrlSort = {
  colId: string;
  sort: "asc" | "desc";
};

export function readListViewUrlSort(
  searchParams: URLSearchParams,
  key = "sort",
): ListViewUrlSort[] {
  const raw = searchParams.get(key)?.trim() ?? "";
  if (raw === "") return [];
  return raw
    .split(",")
    .map((part) => {
      const [colId, dir] = part.split(":");
      if (!colId || (dir !== "asc" && dir !== "desc")) return null;
      return { colId, sort: dir };
    })
    .filter((entry): entry is ListViewUrlSort => entry !== null);
}

export function writeListViewUrlSort(sortModel: ListViewUrlSort[], key = "sort"): [string, string][] {
  if (sortModel.length === 0) return [];
  return [[key, sortModel.map((entry) => `${entry.colId}:${entry.sort}`).join(",")]];
}

export function serializeListViewUrlSort(sortModel: ListViewUrlSort[]): string {
  return sortModel.map((entry) => `${entry.colId}:${entry.sort}`).join(",");
}

export function readListViewUrlSortValue(
  searchParams: URLSearchParams,
  key = "sort",
): string | null {
  const serialized = serializeListViewUrlSort(readListViewUrlSort(searchParams, key));
  return serialized === "" ? null : serialized;
}
