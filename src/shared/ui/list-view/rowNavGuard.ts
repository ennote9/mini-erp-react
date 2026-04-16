/**
 * Use in list grids with row-click navigation: when the user drag-selects cell text,
 * avoid treating the click as a row open action.
 */
export function hasMeaningfulTextSelection(): boolean {
  if (typeof window === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  return sel.toString().trim().length > 0;
}
