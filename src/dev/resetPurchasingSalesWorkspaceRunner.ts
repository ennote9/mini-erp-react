/**
 * Dev-only runner for {@link resetPurchasingSalesOperationalStores}.
 * Attaches to `window` when `import.meta.env.DEV` is true — use from DevTools in `vite` / `tauri dev`.
 * Does not run in production builds.
 */

import {
  resetPurchasingSalesOperationalStores,
  type ResetPurchasingSalesOperationalStoresResult,
} from "./resetPurchasingSalesWorkspace";

export const PURCHASING_SALES_RESET_CONFIRM_TOKEN = "RESET_PURCHASING_SALES" as const;

/**
 * Pure guard for tests and documentation parity.
 * Reset is allowed when either:
 * - `confirm` equals {@link PURCHASING_SALES_RESET_CONFIRM_TOKEN}, or
 * - `viteEnvConfirm` is the literal `YES` (from `VITE_CONFIRM_RESET_PURCHASING_SALES` at build/dev-server start).
 */
export function isPurchasingSalesResetConfirmed(
  confirm: unknown,
  viteEnvConfirm: string | undefined,
): boolean {
  if (viteEnvConfirm === "YES") return true;
  return confirm === PURCHASING_SALES_RESET_CONFIRM_TOKEN;
}

/** Vitest smoke / CI entry; same as `dryRun()` on `window` API. */
export async function devResetPurchasingSalesDryRunForSmoke(): Promise<ResetPurchasingSalesOperationalStoresResult> {
  return resetPurchasingSalesOperationalStores({ dryRun: true });
}

export type MiniErpDevResetPurchasingSalesApi = {
  dryRun: () => Promise<ResetPurchasingSalesOperationalStoresResult>;
  executeReset: (options?: { confirm?: string }) => Promise<ResetPurchasingSalesOperationalStoresResult>;
};

declare global {
  interface Window {
    __MINI_ERP_DEV_RESET_PURCHASING_SALES__?: MiniErpDevResetPurchasingSalesApi;
  }
}

function logResult(label: string, result: ResetPurchasingSalesOperationalStoresResult): void {
  console.info(`[mini-erp dev] ${label}`, result);
  if (result.warnings.length > 0) {
    console.warn(`[mini-erp dev] ${label} warnings`, result.warnings);
  }
  if (result.errors.length > 0) {
    console.error(`[mini-erp dev] ${label} errors`, result.errors);
  }
}

async function dryRun(): Promise<ResetPurchasingSalesOperationalStoresResult> {
  const result = await resetPurchasingSalesOperationalStores({ dryRun: true });
  logResult("resetPurchasingSalesOperationalStores (dry run)", result);
  return result;
}

async function executeReset(
  options?: { confirm?: string },
): Promise<ResetPurchasingSalesOperationalStoresResult> {
  const envVal =
    typeof import.meta.env.VITE_CONFIRM_RESET_PURCHASING_SALES === "string"
      ? import.meta.env.VITE_CONFIRM_RESET_PURCHASING_SALES
      : undefined;
  if (!isPurchasingSalesResetConfirmed(options?.confirm, envVal)) {
    throw new Error(
      [
        "Refused: purchasing/sales reset requires explicit confirmation.",
        `Either start Vite with VITE_CONFIRM_RESET_PURCHASING_SALES=YES, or call:`,
        `  executeReset({ confirm: '${PURCHASING_SALES_RESET_CONFIRM_TOKEN}' })`,
        "See src/dev/README.md.",
      ].join("\n"),
    );
  }
  const result = await resetPurchasingSalesOperationalStores();
  logResult("resetPurchasingSalesOperationalStores (executed)", result);
  console.warn(
    "[mini-erp dev] Purchasing/sales operational JSON stores were cleared on disk. Restart the app or reload the page so in-memory repositories match the new files.",
  );
  return result;
}

function attach(): void {
  window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__ = {
    dryRun,
    executeReset,
  };
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  attach();
}
