import { useEffect, type RefObject } from "react";
import { useSettings } from "../settings/SettingsContext";
import { isErpDialogOpen, isHotkeyFieldBlocked } from "./hotkeyHelpers";

/**
 * `/` focuses the list page search input when not typing elsewhere and no modal is open.
 */
export function useListPageSearchHotkey(searchInputRef: RefObject<HTMLInputElement | null>): void {
  const { settings } = useSettings();
  const enabled = settings.general.hotkeysEnabled;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isHotkeyFieldBlocked(e.target)) return;
      if (isErpDialogOpen()) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchInputRef, enabled]);
}
