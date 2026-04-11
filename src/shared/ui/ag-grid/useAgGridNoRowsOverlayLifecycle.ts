import { useEffect, type RefObject } from "react";
import type { AgGridReact } from "ag-grid-react";

type AnyGridApi = {
  setGridOption?: (key: string, value: unknown) => void;
  showNoRowsOverlay?: () => void;
  hideOverlay?: () => void;
};

/**
 * Shared no-rows overlay lifecycle for AG Grid list pages.
 * Keeps overlay template and visibility in sync without per-page API duplication.
 */
export function useAgGridNoRowsOverlayLifecycle<T>(
  gridRef: RefObject<AgGridReact<T> | null>,
  overlayNoRowsTemplate: string | null | undefined,
  visibleRowCount: number,
) {
  useEffect(() => {
    const api = (gridRef.current?.api as AnyGridApi | undefined) ?? null;
    if (!api) return;
    api.setGridOption?.("overlayNoRowsTemplate", overlayNoRowsTemplate ?? "");
    if (visibleRowCount === 0) {
      api.showNoRowsOverlay?.();
      return;
    }
    api.hideOverlay?.();
  }, [gridRef, overlayNoRowsTemplate, visibleRowCount]);
}
