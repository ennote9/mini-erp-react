/**
 * Copy user-selected image bytes into Tauri app-local storage via plugin-fs.
 * Metadata (relative paths) lives on the Item record.
 */
import { mkdir, writeFile, remove, exists } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { join, appLocalDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ItemImage } from "../model";
import { extensionFromFileName, mimeTypeForExtension, validateItemImageFile } from "./itemImageValidation";

const BD = BaseDirectory.AppLocalData;

/** Relative path prefix under app local data: items/{itemId}/images/ */
export function itemsImagesDirRelative(itemId: string): string {
  return `items/${itemId}/images`;
}

function sanitizeStoredFileName(original: string): string {
  const ext = extensionFromFileName(original);
  const dotExt = ext ? `.${ext}` : "";
  const basePart =
    ext && original.lastIndexOf(".") > 0 ? original.slice(0, original.lastIndexOf(".")) : original;
  const safeBase = basePart.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "image";
  return `${safeBase}-${crypto.randomUUID().slice(0, 8)}${dotExt}`;
}

export async function resolveAbsoluteImagePath(relativePath: string): Promise<string> {
  if (relativePath.includes("..")) {
    throw new Error("Invalid image path.");
  }
  const base = await appLocalDataDir();
  const parts = relativePath.split("/").filter(Boolean);
  return join(base, ...parts);
}

/**
 * Resolve app-local relative path to an absolute filesystem path and a webview-loadable asset URL.
 * Uses forward slashes for `convertFileSrc` (Windows paths from `join` may contain backslashes).
 */
export async function getItemImagePreviewSources(
  relativePath: string,
): Promise<{ absolutePath: string; previewUrl: string }> {
  const absolutePath = await resolveAbsoluteImagePath(relativePath);
  const normalized = absolutePath.replace(/\\/g, "/");
  const previewUrl = convertFileSrc(normalized);
  if (import.meta.env.DEV) {
    console.debug("[itemImageStorage] preview sources", { relativePath, absolutePath, normalized, previewUrl });
  }
  return { absolutePath, previewUrl };
}

/** @deprecated Prefer {@link getItemImagePreviewSources} for diagnostics; same URL behavior. */
export async function getItemImageAssetUrl(relativePath: string): Promise<string> {
  const { previewUrl } = await getItemImagePreviewSources(relativePath);
  return previewUrl;
}

async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const width = bmp.width;
    const height = bmp.height;
    bmp.close();
    return { width, height };
  } catch {
    return {};
  }
}

/** Placement in the item's ordered image list (caller normalizes full array after merge). */
export type ItemImagePlacement = {
  sortOrder: number;
  isPrimary: boolean;
};

export async function saveItemImageFromFile(
  itemId: string,
  file: File,
  placement: ItemImagePlacement,
): Promise<{ image: ItemImage } | { error: string }> {
  const v = validateItemImageFile(file);
  if (v) return { error: v };

  const ext = extensionFromFileName(file.name) ?? "bin";
  const relDir = itemsImagesDirRelative(itemId);
  const safeName = sanitizeStoredFileName(file.name);
  const relativePath = `${relDir}/${safeName}`;

  await mkdir(relDir, { recursive: true, baseDir: BD });
  const buf = new Uint8Array(await file.arrayBuffer());
  await writeFile(relativePath, buf, { baseDir: BD });

  const { width, height } = await readDimensions(file);
  const image: ItemImage = {
    id: crypto.randomUUID(),
    fileName: safeName,
    relativePath,
    mimeType: file.type && file.type.startsWith("image/") ? file.type : mimeTypeForExtension(ext),
    sizeBytes: file.size,
    width,
    height,
    sortOrder: placement.sortOrder,
    isPrimary: placement.isPrimary,
    createdAt: new Date().toISOString(),
  };
  return { image };
}

export async function deleteStoredImageFile(relativePath: string): Promise<void> {
  if (!relativePath.startsWith("items/") || relativePath.includes("..")) return;
  try {
    const pathExists = await exists(relativePath, { baseDir: BD });
    if (pathExists) {
      await remove(relativePath, { baseDir: BD });
    }
  } catch {
    /* best-effort cleanup */
  }
}
