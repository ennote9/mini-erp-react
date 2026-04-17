/**
 * Detect whether Tauri IPC is available for @tauri-apps/plugin-* (e.g. plugin-fs).
 * Plain Vite (`npm run dev`) loads the app in a browser without `invoke`, which causes
 * `TypeError: Cannot read properties of undefined (reading 'invoke')` if plugin-fs runs unguarded.
 */

export function isTauriInternalsPresent(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Use real Tauri plugin-fs APIs. When false, persistence layers that support it should use a
 * browser-safe path (e.g. localStorage) instead of calling plugin-fs.
 *
 * Vitest always uses the mocked `@tauri-apps/plugin-fs` (see tests/setup.ts), so we force the
 * plugin-fs path there even when `window` exists (e.g. happy-dom).
 */
export function shouldUseTauriPluginFs(): boolean {
  if (typeof process !== "undefined" && process.env.VITEST === "true") {
    return true;
  }
  if (typeof window === "undefined") {
    return true;
  }
  return isTauriInternalsPresent();
}
