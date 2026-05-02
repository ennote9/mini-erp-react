import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockFs } from "../support/tauriFsMock";
import { collectWorkspaceBackupExportPayload } from "../../src/shared/backup/exportService";
import {
  getDefaultWorkspaceBackupStoreEntries,
  WORKSPACE_BACKUP_KIND,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
} from "../../src/shared/backup/manifest";
import * as persistenceCoordinator from "../../src/shared/persistenceCoordinator";
import * as settingsPersistence from "../../src/shared/settings/persistence";
import { getAppSettings } from "../../src/shared/settings/store";
import { writeFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";

const encoder = new TextEncoder();

/** Real `persistAppSettings` reference (capture before any `vi.spyOn` replaces the export). */
const persistAppSettingsImpl = settingsPersistence.persistAppSettings;

async function seedJson(path: string, body: string) {
  await writeFile(path, encoder.encode(body), { baseDir: BaseDirectory.AppLocalData });
}

describe("collectWorkspaceBackupExportPayload", () => {
  beforeEach(() => {
    resetMockFs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("collects existing files into payload with manifest, bytes, and missing warnings", async () => {
    await seedJson("documents/sales-orders.json", '{"version":1,"records":[]}');
    await seedJson("inventory/stock-reservations.json", '{"version":1,"records":[]}');
    await seedJson("config/app-settings.json", '{"version":1,"settings":{}}');

    const payload = await collectWorkspaceBackupExportPayload({
      appVersion: "test-version",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(payload.manifest.kind).toBe(WORKSPACE_BACKUP_KIND);
    expect(payload.manifest.backupSchemaVersion).toBe(WORKSPACE_BACKUP_SCHEMA_VERSION);
    expect(payload.manifest.appVersion).toBe("test-version");
    expect(payload.manifest.createdAt).toBe("2026-01-01T00:00:00.000Z");

    expect(payload.files.has("documents/sales-orders.json")).toBe(true);
    expect(payload.files.has("inventory/stock-reservations.json")).toBe(true);
    expect(payload.files.has("config/app-settings.json")).toBe(true);

    const defaultCount = getDefaultWorkspaceBackupStoreEntries().length;
    expect(payload.manifest.stores).toHaveLength(3);
    expect(payload.warnings.filter((w) => w.startsWith("Missing backup store skipped:"))).toHaveLength(
      defaultCount - 3,
    );

    for (const s of payload.manifest.stores) {
      const buf = payload.files.get(s.relativePath);
      expect(buf).toBeDefined();
      expect(s.bytes).toBe(buf!.byteLength);
    }
  });

  it("skips missing files without listing them in files or manifest.stores", async () => {
    await seedJson("documents/sales-orders.json", '{"version":1,"records":[]}');

    const payload = await collectWorkspaceBackupExportPayload({
      appVersion: "v",
      createdAt: "2026-06-15T12:00:00.000Z",
    });

    expect(payload.files.has("inventory/stock-reservations.json")).toBe(false);
    expect(payload.manifest.stores.some((s) => s.relativePath === "inventory/stock-reservations.json")).toBe(
      false,
    );
    expect(payload.warnings.some((w) => w.includes("inventory/stock-reservations.json"))).toBe(true);
  });

  it("rejects when flushAllPendingPersistence fails", async () => {
    vi.spyOn(persistenceCoordinator, "flushAllPendingPersistence").mockRejectedValue(new Error("flush failed"));

    await expect(
      collectWorkspaceBackupExportPayload({
        appVersion: "v",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("flush failed");
  });

  it("invokes persistAppSettings with current getAppSettings snapshot", async () => {
    await seedJson("documents/sales-orders.json", '{"version":1,"records":[]}');
    const spy = vi.spyOn(settingsPersistence, "persistAppSettings").mockImplementation(async (s) => {
      return persistAppSettingsImpl(s);
    });

    await collectWorkspaceBackupExportPayload({
      appVersion: "v",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(getAppSettings());
  });

  it("sorts manifest stores by relativePath regardless of seed order", async () => {
    await seedJson("inventory/stock-reservations.json", '{"a":1}');
    await seedJson("documents/sales-orders.json", '{"b":2}');
    await seedJson("config/app-settings.json", '{"c":3}');

    const payload = await collectWorkspaceBackupExportPayload({
      appVersion: "1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const paths = payload.manifest.stores.map((s) => s.relativePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  it("throws when no default store files exist on disk", async () => {
    vi.spyOn(persistenceCoordinator, "flushAllPendingPersistence").mockResolvedValue(undefined);
    vi.spyOn(settingsPersistence, "persistAppSettings").mockResolvedValue("file_persisted");

    await expect(
      collectWorkspaceBackupExportPayload({
        appVersion: "v",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("No backup store files were found on disk.");
  });

  it("adds a warning when settings persistence is not file_persisted", async () => {
    vi.spyOn(settingsPersistence, "persistAppSettings").mockResolvedValue("fallback_persisted");
    await seedJson("documents/sales-orders.json", "{}");

    const payload = await collectWorkspaceBackupExportPayload({
      appVersion: "v",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(payload.warnings.some((w) => w.includes('persistence state is "fallback_persisted"'))).toBe(true);
    expect(payload.files.size).toBeGreaterThanOrEqual(1);
  });
});
