/**
 * Build a ZIP archive from an in-memory workspace backup payload (no IO to user paths).
 */

import { strToU8, zipSync } from "fflate";
import type { WorkspaceBackupExportPayload } from "./exportService";

/** Fixed ZIP entry time for reproducible archives across runs. */
const ZIP_MTIME = new Date("2020-01-01T00:00:00.000Z");

function assertSafeWorkspaceRelativePath(relativePath: string, context: string): void {
  const p = relativePath.trim();
  if (p === "") {
    throw new Error(`${context}: relativePath must be non-empty.`);
  }
  if (p.includes("..")) {
    throw new Error(`${context}: relativePath must not contain "..".`);
  }
  if (p.startsWith("/") || p.startsWith("\\")) {
    throw new Error(`${context}: relativePath must not be absolute.`);
  }
  if (/^[a-zA-Z]:[/\\]/.test(p)) {
    throw new Error(`${context}: relativePath must not use a drive-letter path.`);
  }
}

/**
 * Ensures `payload.manifest.stores` and `payload.files` describe the same set of safe relative paths.
 */
export function validateWorkspaceBackupPayloadForZip(payload: WorkspaceBackupExportPayload): void {
  const manifestPaths = payload.manifest.stores.map((s) => s.relativePath);
  const seen = new Set<string>();
  for (const rel of manifestPaths) {
    assertSafeWorkspaceRelativePath(rel, `manifest store`);
    if (seen.has(rel)) {
      throw new Error(`Duplicate manifest relativePath: "${rel}".`);
    }
    seen.add(rel);
    if (!payload.files.has(rel)) {
      throw new Error(`Manifest lists "${rel}" but it is missing from payload.files.`);
    }
  }
  for (const key of payload.files.keys()) {
    assertSafeWorkspaceRelativePath(key, `payload.files`);
    if (!seen.has(key)) {
      throw new Error(`payload.files contains "${key}" which is not listed in manifest.stores.`);
    }
  }
}

/**
 * Validates {@link WorkspaceBackupExportPayload}, then builds a ZIP with `manifest.json` at the root
 * and store bytes under `workspace/<relativePath>`.
 */
export function createWorkspaceBackupZipBytes(payload: WorkspaceBackupExportPayload): Uint8Array {
  validateWorkspaceBackupPayloadForZip(payload);

  const zipEntries: Record<string, Uint8Array> = {};
  zipEntries["manifest.json"] = strToU8(JSON.stringify(payload.manifest, null, 2));

  const sortedPaths = [...payload.files.keys()].sort((a, b) => a.localeCompare(b));
  for (const relativePath of sortedPaths) {
    zipEntries[`workspace/${relativePath}`] = payload.files.get(relativePath)!;
  }

  return zipSync(zipEntries, { level: 0, mtime: ZIP_MTIME });
}
