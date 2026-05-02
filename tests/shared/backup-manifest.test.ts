import { describe, expect, it } from "vitest";
import {
  buildWorkspaceBackupManifestV1,
  DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY,
  DEFAULT_WORKSPACE_BACKUP_PLATFORM,
  getDefaultWorkspaceBackupStoreEntries,
  WORKSPACE_BACKUP_KIND,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
} from "../../src/shared/backup/manifest";

const validIso = "2026-05-01T12:00:00.000Z";

function minimalStores() {
  return [
    { id: "z-last", relativePath: "documents/zz-last.json" },
    { id: "a-first", relativePath: "documents/aa-first.json" },
  ];
}

describe("getDefaultWorkspaceBackupStoreEntries", () => {
  it("includes expected core paths", () => {
    const paths = getDefaultWorkspaceBackupStoreEntries().map((e) => e.relativePath);
    expect(paths).toContain("documents/sales-orders.json");
    expect(paths).toContain("inventory/stock-reservations.json");
    expect(paths).toContain("config/app-settings.json");
    expect(paths).toContain("items/items.json");
  });

  it("returns defensive copies that do not share array or entry identity", () => {
    const a = getDefaultWorkspaceBackupStoreEntries();
    const b = getDefaultWorkspaceBackupStoreEntries();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    a[0]!.id = "mutated";
    expect(b[0]!.id).not.toBe("mutated");
  });
});

describe("buildWorkspaceBackupManifestV1", () => {
  it("creates a valid manifest with schema version 1", () => {
    const m = buildWorkspaceBackupManifestV1({
      appVersion: "0.1.0",
      createdAt: validIso,
      stores: getDefaultWorkspaceBackupStoreEntries(),
    });
    expect(m.kind).toBe(WORKSPACE_BACKUP_KIND);
    expect(m.backupSchemaVersion).toBe(WORKSPACE_BACKUP_SCHEMA_VERSION);
    expect(m.appVersion).toBe("0.1.0");
    expect(m.createdAt).toBe(validIso);
    expect(m.platform).toBe(DEFAULT_WORKSPACE_BACKUP_PLATFORM);
    expect(m.baseDirectory).toBe(DEFAULT_WORKSPACE_BACKUP_BASE_DIRECTORY);
    expect(m.stores.length).toBeGreaterThan(0);
  });

  it("sorts stores deterministically by relativePath", () => {
    const m = buildWorkspaceBackupManifestV1({
      appVersion: "1",
      createdAt: validIso,
      stores: minimalStores(),
    });
    expect(m.stores.map((s) => s.relativePath)).toEqual([
      "documents/aa-first.json",
      "documents/zz-last.json",
    ]);
    expect(m.stores.map((s) => s.id)).toEqual(["a-first", "z-last"]);
  });

  it("rejects empty store list", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [],
      }),
    ).toThrow("stores must be non-empty");
  });

  it("rejects duplicate relative paths", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [
          { id: "a", relativePath: "documents/x.json" },
          { id: "b", relativePath: "documents/x.json" },
        ],
      }),
    ).toThrow('Duplicate relativePath: "documents/x.json"');
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [
          { id: "same", relativePath: "documents/a.json" },
          { id: "same", relativePath: "documents/b.json" },
        ],
      }),
    ).toThrow('Duplicate store id: "same"');
  });

  it("rejects absolute paths", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "/documents/x.json" }],
      }),
    ).toThrow("safe relative path");
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "C:/evil.json" }],
      }),
    ).toThrow("safe relative path");
  });

  it("rejects paths containing ..", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "documents/../secrets.json" }],
      }),
    ).toThrow("safe relative path");
  });

  it("rejects empty appVersion", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "   ",
        createdAt: validIso,
        stores: minimalStores(),
      }),
    ).toThrow("appVersion must be non-empty");
  });

  it("rejects invalid createdAt", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: "",
        stores: minimalStores(),
      }),
    ).toThrow("createdAt must be non-empty");
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: "not-a-date",
        stores: minimalStores(),
      }),
    ).toThrow("parseable date");
  });

  it("preserves bytes and sha256 when provided", () => {
    const m = buildWorkspaceBackupManifestV1({
      appVersion: "1",
      createdAt: validIso,
      stores: [
        { id: "b", relativePath: "documents/b.json", bytes: 42, sha256: "abc" },
        { id: "a", relativePath: "documents/a.json", bytes: 0 },
      ],
    });
    const a = m.stores.find((s) => s.relativePath === "documents/a.json");
    const b = m.stores.find((s) => s.relativePath === "documents/b.json");
    expect(a).toMatchObject({ bytes: 0 });
    expect(b).toMatchObject({ bytes: 42, sha256: "abc" });
  });

  it("rejects invalid bytes", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "documents/x.json", bytes: -1 }],
      }),
    ).toThrow("non-negative finite");
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "documents/x.json", bytes: Number.NaN }],
      }),
    ).toThrow("non-negative finite");
  });

  it("rejects empty sha256 when provided", () => {
    expect(() =>
      buildWorkspaceBackupManifestV1({
        appVersion: "1",
        createdAt: validIso,
        stores: [{ id: "x", relativePath: "documents/x.json", sha256: "   " }],
      }),
    ).toThrow("sha256 must be a non-empty string");
  });

  it("includes notes when provided", () => {
    const m = buildWorkspaceBackupManifestV1({
      appVersion: "1",
      createdAt: validIso,
      stores: minimalStores(),
      notes: ["one", "two"],
    });
    expect(m.notes).toEqual(["one", "two"]);
  });

  it("omits notes when empty array", () => {
    const m = buildWorkspaceBackupManifestV1({
      appVersion: "1",
      createdAt: validIso,
      stores: minimalStores(),
      notes: [],
    });
    expect(m.notes).toBeUndefined();
  });
});
