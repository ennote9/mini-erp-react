import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createWorkspaceBackupZipBytes } from "../../src/shared/backup/archive";
import {
  buildWorkspaceBackupManifestV1,
  DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY,
  DEFAULT_WORKSPACE_BACKUP_PLATFORM,
  WORKSPACE_BACKUP_KIND,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
  type WorkspaceBackupManifestV1,
} from "../../src/shared/backup/manifest";
import type { WorkspaceBackupExportPayload } from "../../src/shared/backup/exportService";

const iso = "2026-01-01T00:00:00.000Z";

function makePayload(
  files: Record<string, Uint8Array>,
): WorkspaceBackupExportPayload {
  const map = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(files)) {
    map.set(k, v);
  }
  const paths = Object.keys(files).sort((a, b) => a.localeCompare(b));
  const manifest = buildWorkspaceBackupManifestV1({
    appVersion: "test-app",
    createdAt: iso,
    stores: paths.map((relativePath) => ({
      id: relativePath.replace(/\//g, "-"),
      relativePath,
      bytes: files[relativePath]!.byteLength,
    })),
  });
  return { manifest, files: map, warnings: [] };
}

describe("createWorkspaceBackupZipBytes", () => {
  it("creates a ZIP with manifest.json and workspace/* files matching payload", () => {
    const a = new TextEncoder().encode('{"version":1,"records":[]}');
    const b = new TextEncoder().encode("binary\x00data");
    const payload = makePayload({
      "documents/sales-orders.json": a,
      "inventory/stock-reservations.json": b,
      "config/app-settings.json": new TextEncoder().encode("{}"),
    });

    const zipBytes = createWorkspaceBackupZipBytes(payload);
    const out = unzipSync(zipBytes) as Record<string, Uint8Array>;

    expect(out["manifest.json"]).toBeDefined();
    const parsed = JSON.parse(strFromU8(out["manifest.json"]!));
    expect(parsed).toEqual(payload.manifest);
    expect(parsed.kind).toBe(WORKSPACE_BACKUP_KIND);

    expect(out["workspace/documents/sales-orders.json"]).toEqual(a);
    expect(out["workspace/inventory/stock-reservations.json"]).toEqual(b);
    expect(out["workspace/config/app-settings.json"]).toEqual(new TextEncoder().encode("{}"));
  });

  it("rejects when a manifest store is missing from files", () => {
    const files = new Map<string, Uint8Array>([["documents/a.json", new Uint8Array([1])]]);
    const manifest = buildWorkspaceBackupManifestV1({
      appVersion: "v",
      createdAt: iso,
      stores: [
        { id: "a", relativePath: "documents/a.json", bytes: 1 },
        { id: "b", relativePath: "documents/b.json", bytes: 1 },
      ],
    });
    const payload: WorkspaceBackupExportPayload = { manifest, files, warnings: [] };

    expect(() => createWorkspaceBackupZipBytes(payload)).toThrow(
      'Manifest lists "documents/b.json" but it is missing from payload.files.',
    );
  });

  it("rejects when files contains an entry not listed in manifest", () => {
    const payload = makePayload({
      "documents/a.json": new Uint8Array([1]),
    });
    payload.files.set("documents/extra.json", new Uint8Array([2]));

    expect(() => createWorkspaceBackupZipBytes(payload)).toThrow(
      'payload.files contains "documents/extra.json" which is not listed in manifest.stores.',
    );
  });

  it.each([
    ["../evil.json", new Uint8Array([1])],
    ["/absolute.json", new Uint8Array([1])],
    ["C:/absolute.json", new Uint8Array([1])],
  ])("rejects unsafe path %s", (badPath, bytes) => {
    const manifest: WorkspaceBackupManifestV1 = {
      kind: WORKSPACE_BACKUP_KIND,
      backupSchemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      appVersion: "v",
      createdAt: iso,
      platform: DEFAULT_WORKSPACE_BACKUP_PLATFORM,
      baseDirectory: DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY,
      stores: [{ id: "x", relativePath: badPath as string, bytes: bytes.byteLength }],
    };
    const payload: WorkspaceBackupExportPayload = {
      manifest,
      files: new Map([[badPath as string, bytes]]),
      warnings: [],
    };

    expect(() => createWorkspaceBackupZipBytes(payload)).toThrow(/relativePath/);
  });

  it("rejects duplicate manifest relativePath", () => {
    const manifest: WorkspaceBackupManifestV1 = {
      kind: WORKSPACE_BACKUP_KIND,
      backupSchemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      appVersion: "v",
      createdAt: iso,
      platform: DEFAULT_WORKSPACE_BACKUP_PLATFORM,
      baseDirectory: DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY,
      stores: [
        { id: "a", relativePath: "documents/x.json", bytes: 1 },
        { id: "b", relativePath: "documents/x.json", bytes: 1 },
      ],
    };

    const payload: WorkspaceBackupExportPayload = {
      manifest,
      files: new Map([["documents/x.json", new Uint8Array([1])]]),
      warnings: [],
    };

    expect(() => createWorkspaceBackupZipBytes(payload)).toThrow(
      'Duplicate manifest relativePath: "documents/x.json".',
    );
  });

  it("produces identical zip bytes for the same payload", () => {
    const payload = makePayload({
      "z-last.json": new TextEncoder().encode("z"),
      "a-first.json": new TextEncoder().encode("aaa"),
    });
    const a = createWorkspaceBackupZipBytes(payload);
    const b = createWorkspaceBackupZipBytes(payload);
    expect(a).toEqual(b);
  });

  it("lists workspace entries in sorted path order inside the zip", () => {
    const payload = makePayload({
      "inventory/z.json": new Uint8Array([1]),
      "documents/a.json": new Uint8Array([2]),
    });
    const zipBytes = createWorkspaceBackupZipBytes(payload);
    const out = unzipSync(zipBytes) as Record<string, Uint8Array>;
    const keys = Object.keys(out).filter((k) => k.startsWith("workspace/"));
    expect(keys).toEqual(["workspace/documents/a.json", "workspace/inventory/z.json"]);
  });
});
