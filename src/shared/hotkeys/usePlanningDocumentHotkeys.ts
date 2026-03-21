import { useEffect, useRef } from "react";
import { isErpDialogOpen, isHotkeyFieldBlocked } from "./hotkeyHelpers";

export type PlanningDocumentHotkeyHandlers = {
  isEditable: boolean;
  editingLineId: number | null;
  isLineImportModalOpen: boolean;
  onSave: () => void;
  onAddLine: () => void;
  onOpenLineImport: () => void;
  /** Sales order: allocate when confirmed */
  allocateStockAvailable?: boolean;
  onAllocateStock?: () => void;
};

/**
 * Ctrl/Cmd+S save, Alt+A add line, Alt+L import modal, Alt+Shift+A allocate (when wired).
 * Skips when line-import modal is open, any ERP dialog is open, or focus is in an editable field.
 */
export function usePlanningDocumentHotkeys(handlers: PlanningDocumentHotkeyHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;
      if (h.isLineImportModalOpen) return;
      if (isErpDialogOpen()) return;
      if (isHotkeyFieldBlocked(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === "s") {
        if (!h.isEditable) return;
        e.preventDefault();
        h.onSave();
        return;
      }

      if (e.altKey && e.shiftKey && !mod && e.code === "KeyA") {
        if (!h.allocateStockAvailable || !h.onAllocateStock) return;
        e.preventDefault();
        h.onAllocateStock();
        return;
      }

      if (e.altKey && !e.shiftKey && !mod && e.code === "KeyA") {
        if (!h.isEditable || h.editingLineId !== null) return;
        e.preventDefault();
        h.onAddLine();
        return;
      }

      if (e.altKey && !e.shiftKey && !mod && e.code === "KeyL") {
        if (!h.isEditable || h.editingLineId !== null) return;
        e.preventDefault();
        h.onOpenLineImport();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
