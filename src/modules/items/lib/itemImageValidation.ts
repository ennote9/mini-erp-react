/** Phase 1 image upload rules for Items. */

export const ITEM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

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
