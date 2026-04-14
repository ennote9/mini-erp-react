import { forwardRef, useCallback, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import type { AgGridReact } from "ag-grid-react";
import { useSettings } from "@/shared/settings/SettingsContext";

type AgGridContainerProps = {
  /** Theme/scoping class for dark styling (e.g. "stock-movements-grid"). Must match a block in App.css. */
  themeClass: string;
  children: ReactNode;
  /** Pass list-page gridRef to enable shared fill-width policy with manual-resize protection. */
  gridRef?: RefObject<AgGridReact<any> | null>;
  /** Width/layout policy for the wrapped grid. */
  fitWidthMode?: "managed" | "initial-only";
};

/**
 * Shared wrapper for list-page AG Grids. Fills available height in the list-page
 * content area so the grid stretches. Use with AgGridReact as child. Dark theme
 * is applied via themeClass in App.css.
 */
export const AgGridContainer = forwardRef<HTMLDivElement, AgGridContainerProps>(
  function AgGridContainer({ themeClass, children, gridRef, fitWidthMode = "managed" }, ref) {
    const { settings } = useSettings();
    const localRef = useRef<HTMLDivElement | null>(null);
    const isLight =
      settings.general.theme !== "dark" &&
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("light");

    type AnyGridApi = {
      doLayout?: () => void;
      refreshHeader?: () => void;
      sizeColumnsToFit?: () => void;
      addEventListener?: (eventType: string, listener: (event: any) => void) => void;
      removeEventListener?: (eventType: string, listener: (event: any) => void) => void;
      getColumnState?: () => Array<{ colId: string; width?: number }>;
      applyColumnState?: (params: { state: Array<{ colId: string; width?: number }>; applyOrder?: boolean }) => boolean;
    };

    /**
     * Shared list-page AG Grid fill-width policy:
     * 1) initial controlled sizeColumnsToFit once width is stable;
     * 2) re-apply on meaningful container width recoveries;
     * 3) stop auto-fit after user manual column resize in this grid instance.
     */
    useEffect(() => {
      if (!gridRef) return;
      const container = localRef.current;
      if (!container || typeof window === "undefined") return;

      let rafId = 0;
      let observer: ResizeObserver | null = null;
      let cancelled = false;
      let attachedApi: AnyGridApi | null = null;
      let lastFittedWidth = -1;
      let initialFitComplete = false;
      const autoFitEnabledRef = { current: true };
      const MEANINGFUL_WIDTH_DELTA = 20;
      const lastKnownColumnWidthsRef = { current: [] as Array<{ colId: string; width: number }> };
      const restoringColumnStateRef = { current: false };

      const onColumnResized = (event: any) => {
        if (fitWidthMode === "initial-only") return;
        const api = getApi();
        const source = typeof event?.source === "string" ? event.source.toLowerCase() : "";
        if (api?.getColumnState) {
          const widths = api
            .getColumnState()
            .map((col) => ({ colId: col.colId, width: typeof col.width === "number" ? col.width : 0 }))
            .filter((col) => col.width > 0);
          if (widths.length > 0) {
            lastKnownColumnWidthsRef.current = widths;
          }
        }
        if (source.startsWith("ui")) {
          autoFitEnabledRef.current = false;
        }
      };

      const getCurrentWidthsSnapshot = (api: AnyGridApi | null) => {
        if (!api?.getColumnState) return [] as Array<{ colId: string; width: number }>;
        return api
          .getColumnState()
          .map((col) => ({ colId: col.colId, width: typeof col.width === "number" ? col.width : 0 }))
          .filter((col) => col.width > 0);
      };

      const widthsEqual = (
        a: Array<{ colId: string; width: number }>,
        b: Array<{ colId: string; width: number }>,
      ) => {
        if (a.length !== b.length) return false;
        const byId = new Map(a.map((entry) => [entry.colId, entry.width]));
        for (const entry of b) {
          if (byId.get(entry.colId) !== entry.width) return false;
        }
        return true;
      };

      const restoreColumnWidthsSnapshot = () => {
        if (fitWidthMode === "initial-only") return;
        const api = getApi();
        if (!api?.applyColumnState) return;
        const widths = lastKnownColumnWidthsRef.current;
        if (widths.length === 0) return;
        const currentWidths = getCurrentWidthsSnapshot(api);
        if (widthsEqual(widths, currentWidths)) return;
        if (restoringColumnStateRef.current) return;
        restoringColumnStateRef.current = true;
        api.applyColumnState({ state: widths, applyOrder: false });
        api.doLayout?.();
        api.refreshHeader?.();
        requestAnimationFrame(() => {
          restoringColumnStateRef.current = false;
        });
      };

      const onNewColumnsLoaded = () => {
        restoreColumnWidthsSnapshot();
      };

      const onGridColumnsChanged = () => {
        restoreColumnWidthsSnapshot();
      };

      const getApi = (): AnyGridApi | null => {
        const api = (gridRef.current?.api as AnyGridApi | undefined) ?? null;
        return api;
      };

      const attachColumnResizeListener = () => {
        if (fitWidthMode === "initial-only") return;
        const api = getApi();
        if (!api || api === attachedApi) return;
        attachedApi?.removeEventListener?.("columnResized", onColumnResized);
        attachedApi?.removeEventListener?.("newColumnsLoaded", onNewColumnsLoaded);
        attachedApi?.removeEventListener?.("gridColumnsChanged", onGridColumnsChanged);
        attachedApi?.removeEventListener?.("columnEverythingChanged", onGridColumnsChanged);
        attachedApi?.removeEventListener?.("displayedColumnsChanged", onGridColumnsChanged);
        attachedApi = api;
        attachedApi.addEventListener?.("columnResized", onColumnResized);
        attachedApi.addEventListener?.("newColumnsLoaded", onNewColumnsLoaded);
        attachedApi.addEventListener?.("gridColumnsChanged", onGridColumnsChanged);
        attachedApi.addEventListener?.("columnEverythingChanged", onGridColumnsChanged);
        attachedApi.addEventListener?.("displayedColumnsChanged", onGridColumnsChanged);
      };

      const hasStaleRightDeadArea = (): boolean => {
        const root = localRef.current;
        if (!root) return false;
        const viewport = root.querySelector<HTMLElement>(".ag-center-cols-viewport");
        const containerEl = root.querySelector<HTMLElement>(".ag-center-cols-container");
        if (!viewport || !containerEl) return false;
        const vw = Math.round(viewport.getBoundingClientRect().width);
        const cw = Math.round(containerEl.getBoundingClientRect().width);
        return vw - cw > 24;
      };

      const runFillWidth = (width: number, allowStaleRecovery: boolean) => {
        const api = getApi();
        if (!api) return;
        attachColumnResizeListener();

        if (fitWidthMode === "managed") {
          api.doLayout?.();
          api.refreshHeader?.();
        }

        if (!autoFitEnabledRef.current) return;
        if (fitWidthMode === "initial-only" && initialFitComplete) return;
        const widthChanged = Math.abs(width - lastFittedWidth) >= MEANINGFUL_WIDTH_DELTA;
        const staleDeadArea =
          fitWidthMode === "managed" && allowStaleRecovery ? hasStaleRightDeadArea() : false;
        if (!widthChanged && !staleDeadArea) {
          return;
        }
        lastFittedWidth = width;
        api.sizeColumnsToFit?.();
        if (fitWidthMode === "initial-only") {
          initialFitComplete = true;
          return;
        }
        if (api.getColumnState) {
          const widths = api
            .getColumnState()
            .map((col) => ({ colId: col.colId, width: typeof col.width === "number" ? col.width : 0 }))
            .filter((col) => col.width > 0);
          if (widths.length > 0) {
            lastKnownColumnWidthsRef.current = widths;
          }
        }
      };

      const scheduleWhenStable = (reason: "init" | "observer" | "pageshow" | "popstate" | "visibility") => {
        cancelAnimationFrame(rafId);
        let attempts = 0;
        let stableFrames = 0;
        let prevWidth = -1;
        let prevHeight = -1;

        const tick = () => {
          if (cancelled) return;
          attempts += 1;
          const el = localRef.current;
          const api = getApi();
          if (!el || !api) {
            if (attempts < 36) rafId = requestAnimationFrame(tick);
            return;
          }
          const rect = el.getBoundingClientRect();
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);
          if (width <= 0 || height <= 0) {
            if (attempts < 36) rafId = requestAnimationFrame(tick);
            return;
          }

          if (Math.abs(width - prevWidth) <= 1 && Math.abs(height - prevHeight) <= 1) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
          }
          prevWidth = width;
          prevHeight = height;

          if (stableFrames >= 1 || attempts >= 16) {
            const allowStaleRecovery = reason !== "observer";
            runFillWidth(width, allowStaleRecovery);
            return;
          }
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      };

      const onPageShow = () => scheduleWhenStable("pageshow");
      const onPopState = () => scheduleWhenStable("popstate");
      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          scheduleWhenStable("visibility");
        }
      };

      window.addEventListener("pageshow", onPageShow);
      window.addEventListener("popstate", onPopState);
      document.addEventListener("visibilitychange", onVisibility);

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => scheduleWhenStable("observer"));
        observer.observe(container);
      }

      scheduleWhenStable("init");

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        observer?.disconnect();
        attachedApi?.removeEventListener?.("columnResized", onColumnResized);
        attachedApi?.removeEventListener?.("newColumnsLoaded", onNewColumnsLoaded);
        attachedApi?.removeEventListener?.("gridColumnsChanged", onGridColumnsChanged);
        attachedApi?.removeEventListener?.("columnEverythingChanged", onGridColumnsChanged);
        attachedApi?.removeEventListener?.("displayedColumnsChanged", onGridColumnsChanged);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("popstate", onPopState);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, [fitWidthMode, gridRef]);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
          return;
        }
        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    return (
      <div
        ref={setRefs}
        className={`${isLight ? "ag-theme-quartz" : "ag-theme-quartz-dark"} erp-ag-grid ${themeClass} flex min-h-0 w-full flex-1 flex-col`.trim()}
      >
        {children}
      </div>
    );
  },
);
