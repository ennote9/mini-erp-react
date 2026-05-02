/**
 * Collects an in-memory workspace backup payload (no zip, no dialogs).
 */

import { BaseDirectory, exists, readFile } from "@tauri-apps/plugin-fs";
import { flushAllPendingPersistence } from "../persistenceCoordinator";
import { persistAppSettings } from "../settings/persistence";
import type { SettingsPersistenceState } from "../settings/persistenceState";
import { getAppSettings } from "../settings/store";
import {
  buildWorkspaceBackupManifestV1,
  getDefaultWorkspaceBackupStoreEntries,
  type WorkspaceBackupManifestV1,
} from "./manifest";

export type WorkspaceBackupCollectedFile = {
  relativePath: string;
  bytes: Uint8Array;
};

export type WorkspaceBackupExportPayload = {
  manifest: WorkspaceBackupManifestV1;
  files: Map<string, Uint8Array>;
  warnings: string[];
};

export type CollectWorkspaceBackupExportPayloadOptions = {
  appVersion: string;
  /** ISO-8601 string; defaults to `new Date().toISOString()`. */
  createdAt?: string;
};

function settingsPersistenceWarning(state: SettingsPersistenceState): string | null {
  if (state === "file_persisted") return null;
  return `App settings persistence state is "${state}"; config/app-settings.json may be absent or stale.`;
}

/**
 * Flushes registered persistence, persists current app settings, reads default store files from
 * AppLocalData, and builds a manifest listing only files that were read successfully.
 */
export async function collectWorkspaceBackupExportPayload(
  options: CollectWorkspaceBackupExportPayloadOptions,
): Promise<WorkspaceBackupExportPayload> {
  await flushAllPendingPersistence();

  const warnings: string[] = [];
  const settingsState = await persistAppSettings(getAppSettings());
  const settingsWarn = settingsPersistenceWarning(settingsState);
  if (settingsWarn) warnings.push(settingsWarn);

  const defaults = getDefaultWorkspaceBackupStoreEntries();
  const files = new Map<string, Uint8Array>();

  for (const entry of defaults) {
    const path = entry.relativePath;
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!fileExists) {
      warnings.push(`Missing backup store skipped: ${path}`);
      continue;
    }
    const bytes = await readFile(path, { baseDir: BaseDirectory.AppLocalData });
    files.set(path, bytes);
  }

  if (files.size === 0) {
    throw new Error("No backup store files were found on disk.");
  }

  const stores = defaults
    .filter((e) => files.has(e.relativePath))
    .map((e) => {
      const buf = files.get(e.relativePath)!;
      return {
        id: e.id,
        relativePath: e.relativePath,
        bytes: buf.byteLength,
      };
    });

  const manifest = buildWorkspaceBackupManifestV1({
    appVersion: options.appVersion,
    createdAt: options.createdAt ?? new Date().toISOString(),
    stores,
  });

  return { manifest, files, warnings };
}
