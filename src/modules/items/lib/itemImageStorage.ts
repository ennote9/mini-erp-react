/**
 * Copy user-selected image bytes into Tauri app-local storage via plugin-fs.
 * In plain browser / Vite dev (no Tauri IPC), bytes persist in IndexedDB instead.
 * Metadata (relative paths) lives on the Item record.
 */
import { mkdir, writeFile, remove, exists } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { join, appLocalDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { shouldUseTauriPluginFs } from "@/shared/tauriRuntime";
import type { ItemImage } from "../model";
import { extensionFromFileName, mimeTypeForExtension, validateItemImageFile } from "./itemImageValidation";

const BD = BaseDirectory.AppLocalData;

/** Stable messages returned in `{ error }` — map to i18n in UI. */
export const ITEM_IMAGE_STORAGE_ERROR_TOO_LARGE = "Image must be 10 MB or smaller.";
export const ITEM_IMAGE_STORAGE_ERROR_BAD_TYPE = "Allowed types: JPG, JPEG, PNG, WebP.";
export const ITEM_IMAGE_STORAGE_ERROR_BROWSER_PERSIST =
  "Could not store image in browser storage (quota or IndexedDB unavailable).";

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

// --- Browser / IndexedDB (plain `npm run dev`) --------------------------------

const IDB_NAME = "mini-erp-item-images-v1";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

/** Revoke object URLs when blobs are replaced or deleted. */
const browserObjectUrlByPath = new Map<string, string>();

function releaseBrowserPreviewUrl(relativePath: string): void {
  const url = browserObjectUrlByPath.get(relativePath);
  if (url) {
    URL.revokeObjectURL(url);
    browserObjectUrlByPath.delete(relativePath);
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function idbPutBlob(relativePath: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(IDB_STORE).put(blob, relativePath);
  });
  db.close();
}

async function idbGetBlob(relativePath: string): Promise<Blob | undefined> {
  const db = await openIdb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(relativePath);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return blob;
}

async function idbDeleteBlob(relativePath: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    tx.objectStore(IDB_STORE).delete(relativePath);
  });
  db.close();
}

async function getItemImagePreviewSourcesBrowser(
  relativePath: string,
): Promise<{ absolutePath: string; previewUrl: string }> {
  if (relativePath.includes("..")) {
    throw new Error("Invalid image path.");
  }
  const cached = browserObjectUrlByPath.get(relativePath);
  if (cached) {
    return { absolutePath: "", previewUrl: cached };
  }
  const blob = await idbGetBlob(relativePath);
  if (!blob) {
    throw new Error("Image not found in browser storage.");
  }
  const previewUrl = URL.createObjectURL(blob);
  browserObjectUrlByPath.set(relativePath, previewUrl);
  return { absolutePath: "", previewUrl };
}

export async function resolveAbsoluteImagePath(relativePath: string): Promise<string> {
  if (!shouldUseTauriPluginFs()) {
    throw new Error("Filesystem path is not available in browser dev mode.");
  }
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
 * In browser dev, resolves from IndexedDB via object URL.
 */
export async function getItemImagePreviewSources(
  relativePath: string,
): Promise<{ absolutePath: string; previewUrl: string }> {
  if (!shouldUseTauriPluginFs()) {
    try {
      return await getItemImagePreviewSourcesBrowser(relativePath);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.debug("[itemImageStorage] browser preview failed", { relativePath, e });
      }
      throw e;
    }
  }

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

function buildItemImageMeta(
  safeName: string,
  relativePath: string,
  file: File,
  ext: string,
  placement: ItemImagePlacement,
): ItemImage {
  return {
    id: crypto.randomUUID(),
    fileName: safeName,
    relativePath,
    mimeType: file.type && file.type.startsWith("image/") ? file.type : mimeTypeForExtension(ext),
    sizeBytes: file.size,
    sortOrder: placement.sortOrder,
    isPrimary: placement.isPrimary,
    createdAt: new Date().toISOString(),
  };
}

export async function saveItemImageFromFile(
  itemId: string,
  file: File,
  placement: ItemImagePlacement,
): Promise<{ image: ItemImage } | { error: string }> {
  const v = validateItemImageFile(file);
  if (v === "too_large") return { error: ITEM_IMAGE_STORAGE_ERROR_TOO_LARGE };
  if (v === "bad_type") return { error: ITEM_IMAGE_STORAGE_ERROR_BAD_TYPE };

  const ext = extensionFromFileName(file.name) ?? "bin";
  const relDir = itemsImagesDirRelative(itemId);
  const safeName = sanitizeStoredFileName(file.name);
  const relativePath = `${relDir}/${safeName}`;

  const { width, height } = await readDimensions(file);

  if (!shouldUseTauriPluginFs()) {
    try {
      const buf = await file.arrayBuffer();
      const mime =
        file.type && file.type.startsWith("image/")
          ? file.type
          : mimeTypeForExtension(ext);
      const blob = new Blob([buf], { type: mime });
      releaseBrowserPreviewUrl(relativePath);
      await idbPutBlob(relativePath, blob);
      const image: ItemImage = {
        ...buildItemImageMeta(safeName, relativePath, file, ext, placement),
        width,
        height,
      };
      return { image };
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[itemImageStorage] browser save failed", e);
      }
      return { error: ITEM_IMAGE_STORAGE_ERROR_BROWSER_PERSIST };
    }
  }

  await mkdir(relDir, { recursive: true, baseDir: BD });
  const buf = new Uint8Array(await file.arrayBuffer());
  await writeFile(relativePath, buf, { baseDir: BD });

  const image: ItemImage = {
    ...buildItemImageMeta(safeName, relativePath, file, ext, placement),
    width,
    height,
  };
  return { image };
}

export async function deleteStoredImageFile(relativePath: string): Promise<void> {
  if (!relativePath.startsWith("items/") || relativePath.includes("..")) return;

  if (!shouldUseTauriPluginFs()) {
    try {
      releaseBrowserPreviewUrl(relativePath);
      await idbDeleteBlob(relativePath);
    } catch {
      /* best-effort */
    }
    return;
  }

  try {
    const pathExists = await exists(relativePath, { baseDir: BD });
    if (pathExists) {
      await remove(relativePath, { baseDir: BD });
    }
  } catch {
    /* best-effort cleanup */
  }
}
