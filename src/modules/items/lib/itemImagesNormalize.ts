/**
 * Normalize item image arrays: unique ids, contiguous sortOrder, exactly one primary when non-empty.
 */
import type { ItemImage } from "../model";

export function sortImagesForDisplay(images: ItemImage[]): ItemImage[] {
  return [...images].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Returns a new array: unique ids, sortOrder 0..n-1 by current display order, at most one isPrimary (first sorted if none).
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

  let primaryIndex = reordered.findIndex((x) => x.isPrimary);
  if (primaryIndex < 0) primaryIndex = 0;

  return reordered.map((img, i) => ({
    ...img,
    isPrimary: i === primaryIndex,
  }));
}

export function getPrimaryImage(images: ItemImage[]): ItemImage | undefined {
  const n = normalizeItemImages(images);
  return n.find((x) => x.isPrimary);
}

/** Swap adjacent positions in display order, then normalize sortOrder. */
export function moveImageInOrder(images: ItemImage[], imageId: string, direction: -1 | 1): ItemImage[] {
  const sorted = sortImagesForDisplay(images);
  const idx = sorted.findIndex((x) => x.id === imageId);
  if (idx < 0) return normalizeItemImages(images);
  const j = idx + direction;
  if (j < 0 || j >= sorted.length) return normalizeItemImages(images);
  const next = [...sorted];
  [next[idx], next[j]] = [next[j], next[idx]];
  return normalizeItemImages(next);
}

export function setPrimaryImage(images: ItemImage[], imageId: string): ItemImage[] {
  return normalizeItemImages(images.map((img) => ({ ...img, isPrimary: img.id === imageId })));
}
