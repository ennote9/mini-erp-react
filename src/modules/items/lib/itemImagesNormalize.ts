/**
 * Normalize item image arrays: unique ids, contiguous sortOrder, exactly one primary when non-empty.
 * Visual order is always sortOrder (tie-breakers); isPrimary does not affect ordering.
 */
import type { ItemImage } from "../model";

/** Display / persistence order: sortOrder only (tie-breakers), never isPrimary. */
export function sortImagesForDisplay(images: ItemImage[]): ItemImage[] {
  return [...images].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** Alias: single source for UI list order (sortOrder-driven). */
export function orderItemImagesBySortOrder(images: ItemImage[]): ItemImage[] {
  return sortImagesForDisplay(images);
}

/**
 * Returns a new array: unique ids, sortOrder 0..n-1 by current display order.
 * Primary stays on the same image id (first flagged primary in sorted input, else first item).
 */
export function normalizeItemImages(images: ItemImage[]): ItemImage[] {
  if (images.length === 0) return [];

  const seen = new Set<string>();
  const idSafe = images.map((img) => {
    let id = img.id;
    while (seen.has(id)) {
      id = crypto.randomUUID();
    }
    seen.add(id);
    return { ...img, id };
  });

  const sorted = sortImagesForDisplay(idSafe);
  const reordered = sorted.map((img, i) => ({ ...img, sortOrder: i }));

  const primaryId = reordered.find((x) => x.isPrimary)?.id ?? reordered[0]!.id;

  return reordered.map((img, i) => ({
    ...img,
    sortOrder: i,
    isPrimary: img.id === primaryId,
  }));
}

export function getPrimaryImage(images: ItemImage[]): ItemImage | undefined {
  const n = normalizeItemImages(images);
  return n.find((x) => x.isPrimary);
}

/**
 * Reorder images to match `newOrderIds` (full permutation). Updates sortOrder 0..n-1.
 * Preserves which image id is primary — does not move primary to another file by position.
 */
export function reorderItemImagesByIdOrder(images: ItemImage[], newOrderIds: string[]): ItemImage[] {
  if (images.length === 0) return [];
  if (newOrderIds.length !== images.length) return normalizeItemImages(images);

  const byId = new Map(images.map((img) => [img.id, img] as const));
  const set = new Set(images.map((i) => i.id));
  for (const id of newOrderIds) {
    if (!set.has(id)) return normalizeItemImages(images);
  }

  const primaryId =
    sortImagesForDisplay(images).find((x) => x.isPrimary)?.id ?? newOrderIds[0]!;

  return newOrderIds.map((id, i) => {
    const img = byId.get(id)!;
    return { ...img, sortOrder: i, isPrimary: id === primaryId };
  });
}

export function setPrimaryImage(images: ItemImage[], imageId: string): ItemImage[] {
  return normalizeItemImages(images.map((img) => ({ ...img, isPrimary: img.id === imageId })));
}
