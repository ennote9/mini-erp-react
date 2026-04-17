import { describe, expect, it } from "vitest";
import { isTauriInternalsPresent, shouldUseTauriPluginFs } from "../../src/shared/tauriRuntime";

describe("tauriRuntime", () => {
  it("forces plugin-fs path under Vitest so mocked @tauri-apps/plugin-fs is used", () => {
    expect(process.env.VITEST).toBe("true");
    expect(shouldUseTauriPluginFs()).toBe(true);
  });

  it("exposes Tauri presence helper", () => {
    expect(typeof isTauriInternalsPresent()).toBe("boolean");
  });
});
