import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultWorkspaceBackupZipFileName,
  exportWorkspaceBackupToFile,
  uint8ArrayToBase64ForExport,
  WORKSPACE_BACKUP_ZIP_SAVE_FILTERS,
} from "../../src/shared/backup/exportToFile";
import { buildWorkspaceBackupManifestV1, WORKSPACE_BACKUP_KIND } from "../../src/shared/backup/manifest";
import type { WorkspaceBackupExportPayload } from "../../src/shared/backup/exportService";

function smallPayload(): WorkspaceBackupExportPayload {
  const files = new Map([["documents/a.json", new TextEncoder().encode("{}")]]);
  const manifest = buildWorkspaceBackupManifestV1({
    appVersion: "t",
    createdAt: "2026-01-01T00:00:00.000Z",
    stores: [{ id: "a", relativePath: "documents/a.json", bytes: 2 }],
  });
  return { manifest, files, warnings: ["w1"] };
}

describe("uint8ArrayToBase64ForExport", () => {
  it("round-trips small binary", () => {
    const bytes = new Uint8Array([0, 255, 1]);
    expect(atob(uint8ArrayToBase64ForExport(bytes)).split("").map((c) => c.charCodeAt(0))).toEqual([
      0, 255, 1,
    ]);
  });
});

describe("buildDefaultWorkspaceBackupZipFileName", () => {
  it("uses local calendar date and HHmmss in the file name", () => {
    const name = buildDefaultWorkspaceBackupZipFileName(new Date(2026, 2, 15, 8, 9, 1));
    expect(name).toBe("mini-erp-backup-2026-03-15-080901.zip");
  });
});

describe("WORKSPACE_BACKUP_ZIP_SAVE_FILTERS", () => {
  it("declares a zip-only filter for the save dialog", () => {
    expect(WORKSPACE_BACKUP_ZIP_SAVE_FILTERS).toEqual([{ name: "ZIP archive", extensions: ["zip"] }]);
  });
});

describe("exportWorkspaceBackupToFile", () => {
  it("successful export calls write with path and base64 zip bytes", async () => {
    const payload = smallPayload();
    const zipBytes = new Uint8Array([7, 8, 9]);
    const collect = vi.fn().mockResolvedValue(payload);
    const zip = vi.fn().mockReturnValue(zipBytes);
    const save = vi.fn().mockResolvedValue("/out/backup.zip");
    const write = vi.fn().mockResolvedValue(undefined);
    const ensureUnique = vi.fn(async (p: string) => p);

    const result = await exportWorkspaceBackupToFile(
      { appVersion: "1.0.0", createdAt: "2026-01-02T00:00:00.000Z" },
      {
        collectWorkspaceBackupExportPayload: collect,
        createWorkspaceBackupZipBytes: zip,
        saveZipFileDialog: save,
        writeExportFileBase64: write,
        ensureUniqueExportPath: ensureUnique,
      },
    );

    expect(result).toEqual({
      success: true,
      path: "/out/backup.zip",
      warnings: ["w1"],
      manifest: payload.manifest,
    });

    expect(collect).toHaveBeenCalledWith({ appVersion: "1.0.0", createdAt: "2026-01-02T00:00:00.000Z" });
    expect(zip).toHaveBeenCalledWith(payload);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toBe("/out/backup.zip");
    const b64 = write.mock.calls[0]![1] as string;
    expect(b64).toBe(uint8ArrayToBase64ForExport(zipBytes));
  });

  it("returns cancelled when save dialog returns null and does not write", async () => {
    const payload = smallPayload();
    const collect = vi.fn().mockResolvedValue(payload);
    const zip = vi.fn().mockReturnValue(new Uint8Array([1]));
    const save = vi.fn().mockResolvedValue(null);
    const write = vi.fn().mockResolvedValue(undefined);
    const ensureUnique = vi.fn(async (p: string) => p);

    const result = await exportWorkspaceBackupToFile(
      { appVersion: "v" },
      {
        collectWorkspaceBackupExportPayload: collect,
        createWorkspaceBackupZipBytes: zip,
        saveZipFileDialog: save,
        writeExportFileBase64: write,
        ensureUniqueExportPath: ensureUnique,
      },
    );

    expect(result).toEqual({ success: false, cancelled: true, warnings: ["w1"] });
    expect(write).not.toHaveBeenCalled();
  });

  it("returns failure when collection throws and does not save or write", async () => {
    const collect = vi.fn().mockRejectedValue(new Error("flush failed"));
    const zip = vi.fn();
    const save = vi.fn();
    const write = vi.fn();
    const ensureUnique = vi.fn();

    const result = await exportWorkspaceBackupToFile(
      { appVersion: "v" },
      {
        collectWorkspaceBackupExportPayload: collect,
        createWorkspaceBackupZipBytes: zip,
        saveZipFileDialog: save,
        writeExportFileBase64: write,
        ensureUniqueExportPath: ensureUnique,
      },
    );

    expect(result).toEqual({ success: false, error: "flush failed" });
    expect(save).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("returns failure when zip creation throws and preserves warnings", async () => {
    const payload = smallPayload();
    const collect = vi.fn().mockResolvedValue(payload);
    const zip = vi.fn().mockImplementation(() => {
      throw new Error("zip failed");
    });
    const save = vi.fn();
    const write = vi.fn();

    const result = await exportWorkspaceBackupToFile(
      { appVersion: "v" },
      {
        collectWorkspaceBackupExportPayload: collect,
        createWorkspaceBackupZipBytes: zip,
        saveZipFileDialog: save,
        writeExportFileBase64: write,
        ensureUniqueExportPath: vi.fn(),
      },
    );

    expect(result).toEqual({ success: false, error: "zip failed", warnings: ["w1"] });
    expect(save).not.toHaveBeenCalled();
  });

  it("returns failure when write throws and preserves warnings", async () => {
    const payload = smallPayload();
    const collect = vi.fn().mockResolvedValue(payload);
    const zip = vi.fn().mockReturnValue(new Uint8Array([1]));
    const save = vi.fn().mockResolvedValue("/x.zip");
    const write = vi.fn().mockRejectedValue(new Error("disk full"));
    const ensureUnique = vi.fn(async (p: string) => p);

    const result = await exportWorkspaceBackupToFile(
      { appVersion: "v" },
      {
        collectWorkspaceBackupExportPayload: collect,
        createWorkspaceBackupZipBytes: zip,
        saveZipFileDialog: save,
        writeExportFileBase64: write,
        ensureUniqueExportPath: ensureUnique,
      },
    );

    expect(result).toEqual({ success: false, error: "disk full", warnings: ["w1"] });
  });

  it("passes custom defaultFileName to save dialog", async () => {
    const payload = smallPayload();
    const save = vi.fn().mockResolvedValue(null);
    await exportWorkspaceBackupToFile(
      { appVersion: "v", defaultFileName: "my-backup.zip" },
      {
        collectWorkspaceBackupExportPayload: vi.fn().mockResolvedValue(payload),
        createWorkspaceBackupZipBytes: vi.fn().mockReturnValue(new Uint8Array([1])),
        saveZipFileDialog: save,
        writeExportFileBase64: vi.fn(),
        ensureUniqueExportPath: vi.fn(async (p) => p),
      },
    );
    expect(save).toHaveBeenCalledWith("my-backup.zip");
  });

  it("uses built-in default zip name when defaultFileName omitted", async () => {
    const payload = smallPayload();
    const save = vi.fn().mockResolvedValue(null);
    await exportWorkspaceBackupToFile(
      { appVersion: "v" },
      {
        collectWorkspaceBackupExportPayload: vi.fn().mockResolvedValue(payload),
        createWorkspaceBackupZipBytes: vi.fn().mockReturnValue(new Uint8Array([1])),
        saveZipFileDialog: save,
        writeExportFileBase64: vi.fn(),
        ensureUniqueExportPath: vi.fn(async (p) => p),
      },
    );
    const arg = save.mock.calls[0]![0] as string;
    expect(arg).toMatch(/^mini-erp-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/);
  });
});
