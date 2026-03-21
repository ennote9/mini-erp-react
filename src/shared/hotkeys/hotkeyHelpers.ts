/**
 * Shared guards for ERP keyboard shortcuts — keep normal typing and modal focus safe.
 */

/** True when focus is in a field where `/` or doc shortcuts should not run. */
export function isHotkeyFieldBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(
    "input, textarea, select, [contenteditable='true'], [role='textbox']",
  );
  if (!el) {
    const combobox = target.closest("[role='combobox']");
    if (combobox) return true;
    return false;
  }
  if (el instanceof HTMLInputElement) {
    const t = el.type;
    if (t === "button" || t === "submit" || t === "reset" || t === "file" || t === "hidden") {
      return false;
    }
    return true;
  }
  return true;
}

/** Radix Dialog.Content uses role="dialog" and data-state="open". */
export function isErpDialogOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') != null;
}
