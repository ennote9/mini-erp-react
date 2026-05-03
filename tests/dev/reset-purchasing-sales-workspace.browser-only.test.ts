import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockFsFailures, resetMockFs } from "../support/tauriFsMock";

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
  resetMockFs();
  clearMockFsFailures();
  vi.stubGlobal("localStorage", createMemoryLocalStorage());
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterEach(async () => {
  clearMockFsFailures();
  vi.unstubAllGlobals();
  try {
    const { flushAllPendingPersistence } = await import("../../src/shared/persistenceCoordinator");
    await flushAllPendingPersistence();
  } catch {
    // ignore
  }
});

describe("resetPurchasingSalesOperationalStores (browser-only / no Tauri FS)", () => {
  it("does not throw; clears operational document keys in localStorage; reports browser persistence mode", async () => {
    vi.resetModules();
    const ls = globalThis.localStorage!;
    ls.setItem(
      "mini-erp-documents-v1:documents/purchase-orders.json",
      JSON.stringify({ version: 1, records: [{ id: "99", fake: true }] }),
    );
    ls.setItem(
      "mini-erp-inventory-v1:inventory/stock-movements.json",
      JSON.stringify({ version: 1, records: [{ id: "m1" }] }),
    );

    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    const result = await resetPurchasingSalesOperationalStores();
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.persistenceMode).toBe("browser_local_storage_only");
    expect(result.warnings.some((w) => w.includes("Tauri file persistence was not available"))).toBe(
      true,
    );

    const poParsed = JSON.parse(
      ls.getItem("mini-erp-documents-v1:documents/purchase-orders.json")!,
    ) as { records: unknown[] };
    expect(poParsed.records).toEqual([]);

    const movParsed = JSON.parse(
      ls.getItem("mini-erp-inventory-v1:inventory/stock-movements.json")!,
    ) as { records: unknown[] };
    expect(movParsed.records).toEqual([]);
  });

  it("filters entity attachments from localStorage when mirror exists", async () => {
    vi.resetModules();
    const ls = globalThis.localStorage!;
    ls.setItem(
      "mini-erp-documents-v1:documents/entity-attachments.json",
      JSON.stringify({
        version: 1,
        records: [
          {
            id: "1",
            entityType: "order",
            entityId: "po-1",
            fileName: "a.pdf",
            storageRef: "r1",
            uploadedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "2",
            entityType: "customer",
            entityId: "c-1",
            fileName: "b.pdf",
            storageRef: "r2",
            uploadedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    const result = await resetPurchasingSalesOperationalStores();
    expect(result.success).toBe(true);
    expect(result.entityAttachmentOperationalRowsRemoved).toBe(1);

    const att = JSON.parse(
      ls.getItem("mini-erp-documents-v1:documents/entity-attachments.json")!,
    ) as { records: Array<{ entityType?: string }> };
    expect(att.records).toHaveLength(1);
    expect(att.records[0].entityType).toBe("customer");
  });

  it("warns when entity-attachments mirror is absent (no throw)", async () => {
    vi.resetModules();
    const { resetPurchasingSalesOperationalStores } = await import(
      "../../src/dev/resetPurchasingSalesWorkspace"
    );
    const result = await resetPurchasingSalesOperationalStores();
    expect(result.success).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.includes("Entity attachments were not filtered because no browser localStorage mirror"),
      ),
    ).toBe(true);
  });
});
