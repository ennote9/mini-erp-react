import { describe, expect, it } from "vitest";
import {
  mergeAppSettingsPatch,
  normalizeAppSettingsFromUnknown,
} from "../../src/shared/settings/mergeNormalize";
import { DEFAULT_APP_SETTINGS } from "../../src/shared/settings/defaults";
import type { AppSettings } from "../../src/shared/settings/types";

describe("mergeAppSettingsPatch — inventory.releaseReservationsOnSalesOrderCancel", () => {
  it("defaults to true on a fresh DEFAULT_APP_SETTINGS clone", () => {
    const cur = structuredClone(DEFAULT_APP_SETTINGS);
    expect(cur.inventory.releaseReservationsOnSalesOrderCancel).toBe(true);
  });

  it("preserves explicit false from a patch", () => {
    const cur = structuredClone(DEFAULT_APP_SETTINGS);
    const next = mergeAppSettingsPatch(cur, {
      inventory: { releaseReservationsOnSalesOrderCancel: false },
    });
    expect(next.inventory.releaseReservationsOnSalesOrderCancel).toBe(false);
  });

  it("preserves explicit true when patching back from false", () => {
    let cur: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
    cur = mergeAppSettingsPatch(cur, {
      inventory: { releaseReservationsOnSalesOrderCancel: false },
    });
    expect(cur.inventory.releaseReservationsOnSalesOrderCancel).toBe(false);
    const next = mergeAppSettingsPatch(cur, {
      inventory: { releaseReservationsOnSalesOrderCancel: true },
    });
    expect(next.inventory.releaseReservationsOnSalesOrderCancel).toBe(true);
  });
});

describe("normalizeAppSettingsFromUnknown — inventory.releaseReservationsOnSalesOrderCancel", () => {
  it("reads false from persisted inventory blob", () => {
    const normalized = normalizeAppSettingsFromUnknown({
      inventory: { releaseReservationsOnSalesOrderCancel: false },
    });
    expect(normalized.inventory.releaseReservationsOnSalesOrderCancel).toBe(false);
  });

  it("falls back to default when inventory or flag is missing", () => {
    expect(normalizeAppSettingsFromUnknown({}).inventory.releaseReservationsOnSalesOrderCancel).toBe(true);
    expect(normalizeAppSettingsFromUnknown({ inventory: {} }).inventory.releaseReservationsOnSalesOrderCancel).toBe(
      true,
    );
  });
});
