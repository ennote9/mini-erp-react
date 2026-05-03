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

describe("purchaseOrderRepository bootstrap (browser-only)", () => {
  it("loads zero purchase orders when localStorage holds an empty envelope", async () => {
    globalThis.localStorage.setItem(
      "mini-erp-documents-v1:documents/purchase-orders.json",
      JSON.stringify({ version: 1, records: [] }),
    );
    vi.resetModules();
    const { purchaseOrderRepository } = await import("../../src/modules/purchase-orders/repository");
    expect(purchaseOrderRepository.list()).toEqual([]);
  });
});
