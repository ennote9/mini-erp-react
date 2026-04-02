import type { ThemePreference } from "./types";

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function applyDarkClass(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
}

/**
 * Apply theme class on <html>. Call after settings load and when theme changes.
 */
export function applyThemeToDocument(theme: ThemePreference): void {
  if (mediaListener) {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", mediaListener);
    mediaListener = null;
  }

  if (theme === "system") {
    applyDarkClass(systemPrefersDark());
    mediaListener = () => applyDarkClass(systemPrefersDark());
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", mediaListener);
    return;
  }

  if (theme === "dark") {
    applyDarkClass(true);
    return;
  }

  applyDarkClass(false);
}
