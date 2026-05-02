/**
 * Export workspace backup to a user-selected .zip via Tauri save dialog + write_export_file.
 */

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { ensureUniqueExportPath } from "../export/filenameBuilder";
import { createWorkspaceBackupZipBytes } from "./archive";
import {
  collectWorkspaceBackupExportPayload,
  type WorkspaceBackupExportPayload,
} from "./exportService";
import type { WorkspaceBackupManifestV1 } from "./manifest";

export type ExportWorkspaceBackupToFileResult =
  | {
      success: true;
      path: string;
      warnings: string[];
      manifest: WorkspaceBackupManifestV1;
    }
  | {
      success: false;
      cancelled?: boolean;
      error?: string;
      warnings?: string[];
    };

export type ExportWorkspaceBackupToFileOptions = {
  appVersion: string;
  createdAt?: string;
  /** Default file name including `.zip` (e.g. `mini-erp-backup-2026-05-01-143022.zip`). */
  defaultFileName?: string;
};

/** Encode bytes for `write_export_file` (same pattern as other exports; avoids Node Buffer). */
export function uint8ArrayToBase64ForExport(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function buildDefaultWorkspaceBackupZipFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `mini-erp-backup-${y}-${m}-${d}-${hh}${mm}${ss}.zip`;
}

/** Passed to `save()` so the system picker prefers `.zip` files. */
export const WORKSPACE_BACKUP_ZIP_SAVE_FILTERS: Array<{ name: string; extensions: string[] }> = [
  { name: "ZIP archive", extensions: ["zip"] },
];

async function defaultSaveZipDialog(defaultPath: string): Promise<string | null> {
  return save({
    defaultPath,
    filters: WORKSPACE_BACKUP_ZIP_SAVE_FILTERS,
  });
}

async function defaultWriteExportFileBase64(path: string, contentsBase64: string): Promise<void> {
  await invoke("write_export_file", { path, contentsBase64 });
}

export type ExportWorkspaceBackupToFileDeps = {
  collectWorkspaceBackupExportPayload: typeof collectWorkspaceBackupExportPayload;
  createWorkspaceBackupZipBytes: typeof createWorkspaceBackupZipBytes;
  saveZipFileDialog: (defaultPath: string) => Promise<string | null>;
  writeExportFileBase64: (path: string, contentsBase64: string) => Promise<void>;
  ensureUniqueExportPath: typeof ensureUniqueExportPath;
};

const defaultDeps: ExportWorkspaceBackupToFileDeps = {
  collectWorkspaceBackupExportPayload,
  createWorkspaceBackupZipBytes,
  saveZipFileDialog: defaultSaveZipDialog,
  writeExportFileBase64: defaultWriteExportFileBase64,
  ensureUniqueExportPath,
};

/**
 * Collects backup payload, builds a ZIP, prompts for save location, and writes via `write_export_file`.
 */
export async function exportWorkspaceBackupToFile(
  options: ExportWorkspaceBackupToFileOptions,
  deps?: Partial<ExportWorkspaceBackupToFileDeps>,
): Promise<ExportWorkspaceBackupToFileResult> {
  const d: ExportWorkspaceBackupToFileDeps = { ...defaultDeps, ...deps };
  let payload: WorkspaceBackupExportPayload | undefined;
  try {
    payload = await d.collectWorkspaceBackupExportPayload({
      appVersion: options.appVersion,
      createdAt: options.createdAt,
    });
    const zipBytes = d.createWorkspaceBackupZipBytes(payload);
    const defaultName = options.defaultFileName ?? buildDefaultWorkspaceBackupZipFileName();
    const pickedPath = await d.saveZipFileDialog(defaultName);
    if (pickedPath == null) {
      return { success: false, cancelled: true, warnings: payload.warnings };
    }
    const safePath = await d.ensureUniqueExportPath(pickedPath);
    const contentsBase64 = uint8ArrayToBase64ForExport(zipBytes);
    await d.writeExportFileBase64(safePath, contentsBase64);
    return {
      success: true,
      path: safePath,
      warnings: payload.warnings,
      manifest: payload.manifest,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: msg,
      ...(payload ? { warnings: payload.warnings } : {}),
    };
  }
}
