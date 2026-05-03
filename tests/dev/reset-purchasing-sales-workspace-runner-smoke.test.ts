import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockFsFailures, resetMockFs } from "../support/tauriFsMock";

beforeEach(() => {
  resetMockFs();
  clearMockFsFailures();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("resetPurchasingSalesWorkspaceRunner (smoke)", () => {
  it("devResetPurchasingSalesDryRunForSmoke returns dry-run result", async () => {
    vi.resetModules();
    const { devResetPurchasingSalesDryRunForSmoke } = await import(
      "../../src/dev/resetPurchasingSalesWorkspaceRunner"
    );
    const result = await devResetPurchasingSalesDryRunForSmoke();
    expect(result.dryRun).toBe(true);
    expect(result.success).toBe(true);
    expect(result.clearedPaths.length).toBeGreaterThan(0);
  });
});
