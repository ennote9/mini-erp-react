/** Image upload rules for Items (multi-image). */

export const ITEM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Max images per item (phase 1). */
export const ITEM_IMAGE_MAX_COUNT = 5;

export const ITEM_IMAGE_ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export function extensionFromFileName(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

export function validateItemImageFile(file: File): string | null {
  if (file.size > ITEM_IMAGE_MAX_BYTES) {
    return "Image must be 10 MB or smaller.";
  }
  const ext = extensionFromFileName(file.name);
  if (!ext || !ITEM_IMAGE_ALLOWED_EXT.has(ext)) {
    return "Allowed types: JPG, JPEG, PNG, WebP.";
  }
  return null;
}

/** When adding (not replacing), enforce max count. */
export function validateItemImageSlotAvailable(currentCount: number): string | null {
  if (currentCount >= ITEM_IMAGE_MAX_COUNT) {
    return `You can add up to ${ITEM_IMAGE_MAX_COUNT} images per item. Remove one to add another.`;
  }
  return null;
}

export function mimeTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
