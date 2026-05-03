import { describe, expect, it } from "vitest";
import {
  isPurchasingSalesResetConfirmed,
  PURCHASING_SALES_RESET_CONFIRM_TOKEN,
} from "../../src/dev/resetPurchasingSalesWorkspaceRunner";

describe("isPurchasingSalesResetConfirmed", () => {
  it("rejects wrong token when env is not YES", () => {
    expect(isPurchasingSalesResetConfirmed(undefined, undefined)).toBe(false);
    expect(isPurchasingSalesResetConfirmed("no", undefined)).toBe(false);
    expect(isPurchasingSalesResetConfirmed("", undefined)).toBe(false);
  });

  it("accepts exact confirmation token", () => {
    expect(isPurchasingSalesResetConfirmed(PURCHASING_SALES_RESET_CONFIRM_TOKEN, undefined)).toBe(true);
  });

  it("accepts VITE_CONFIRM_RESET_PURCHASING_SALES=YES without token", () => {
    expect(isPurchasingSalesResetConfirmed(undefined, "YES")).toBe(true);
    expect(isPurchasingSalesResetConfirmed(undefined, "no")).toBe(false);
  });

  it("token wins when env is absent", () => {
    expect(isPurchasingSalesResetConfirmed(PURCHASING_SALES_RESET_CONFIRM_TOKEN, undefined)).toBe(true);
  });
});
