import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/tauriRuntime", () => ({
  shouldUseTauriPluginFs: () => false,
  isTauriInternalsPresent: () => false,
}));

function createMemoryLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("writeDocumentPayload (browser-only)", () => {
  it("writes the localStorage mirror without calling plugin-fs mkdir", async () => {
    const fs = await import("@tauri-apps/plugin-fs");
    const mkdirSpy = vi.spyOn(fs, "mkdir");
    vi.resetModules();
    const { writeDocumentPayload } = await import("../../src/shared/documentPersistence");
    await writeDocumentPayload("documents/purchase-orders.json", [] as never[]);
    expect(mkdirSpy).not.toHaveBeenCalled();
    const raw = globalThis.localStorage.getItem("mini-erp-documents-v1:documents/purchase-orders.json");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toEqual({ version: 1, records: [] });
  });
});

describe("loadDocumentsPersisted (browser-only)", () => {
  it("returns empty records when localStorage has an empty envelope (does not reseed)", async () => {
    globalThis.localStorage.setItem(
      "mini-erp-documents-v1:documents/purchase-orders.json",
      JSON.stringify({ version: 1, records: [] }),
    );
    const buildSeedRecords = vi.fn(() => [{ id: "SEED", lines: [] }] as unknown[]);
    vi.resetModules();
    const { loadDocumentsPersisted } = await import("../../src/shared/documentPersistence");
    const result = await loadDocumentsPersisted({
      relativePath: "documents/purchase-orders.json",
      buildSeedRecords: buildSeedRecords as () => unknown[],
      normalizeRecord: () => null,
      diagnosticsTag: "test",
    });
    expect(result.records).toEqual([]);
    expect(buildSeedRecords).not.toHaveBeenCalled();
  });

  it("seeds when no localStorage key exists", async () => {
    const buildSeedRecords = vi.fn(() => [{ id: "SEED", lines: [] }] as unknown[]);
    vi.resetModules();
    const { loadDocumentsPersisted } = await import("../../src/shared/documentPersistence");
    const result = await loadDocumentsPersisted({
      relativePath: "documents/purchase-orders.json",
      buildSeedRecords: buildSeedRecords as () => unknown[],
      normalizeRecord: (raw: unknown) =>
        raw && typeof raw === "object" && (raw as { id?: string }).id === "SEED" ? raw : null,
      diagnosticsTag: "test",
    });
    expect(buildSeedRecords).toHaveBeenCalled();
    expect(result.records).toHaveLength(1);
    expect((result.records[0] as { id: string }).id).toBe("SEED");
  });
});
