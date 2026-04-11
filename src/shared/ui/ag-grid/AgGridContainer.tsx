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
};

/**
 * Shared wrapper for list-page AG Grids. Fills available height in the list-page
 * content area so the grid stretches. Use with AgGridReact as child. Dark theme
 * is applied via themeClass in App.css.
 */
export const AgGridContainer = forwardRef<HTMLDivElement, AgGridContainerProps>(
  function AgGridContainer({ themeClass, children, gridRef }, ref) {
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
      let lastFittedHeight = -1;
      const autoFitEnabledRef = { current: true };

      const onColumnResized = (event: any) => {
        const source = typeof event?.source === "string" ? event.source.toLowerCase() : "";
        const finished = event?.finished !== false;
        if (!finished) return;
        if (source.startsWith("ui")) {
          autoFitEnabledRef.current = false;
        }
      };

      const getApi = (): AnyGridApi | null => {
        const api = (gridRef.current?.api as AnyGridApi | undefined) ?? null;
        return api;
      };

      const attachColumnResizeListener = () => {
        const api = getApi();
        if (!api || api === attachedApi) return;
        attachedApi?.removeEventListener?.("columnResized", onColumnResized);
        attachedApi = api;
        attachedApi.addEventListener?.("columnResized", onColumnResized);
      };

      const runFillWidth = (width: number, height: number) => {
        const api = getApi();
        if (!api) return;
        attachColumnResizeListener();

        api.doLayout?.();
        api.refreshHeader?.();

        if (!autoFitEnabledRef.current) return;
        if (Math.abs(width - lastFittedWidth) < 2 && Math.abs(height - lastFittedHeight) < 2) {
          return;
        }
        lastFittedWidth = width;
        lastFittedHeight = height;
        api.sizeColumnsToFit?.();
      };

      const scheduleWhenStable = () => {
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
            runFillWidth(width, height);
            return;
          }
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      };

      const onPageShow = () => scheduleWhenStable();
      const onPopState = () => scheduleWhenStable();
      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          scheduleWhenStable();
        }
      };

      window.addEventListener("pageshow", onPageShow);
      window.addEventListener("popstate", onPopState);
      document.addEventListener("visibilitychange", onVisibility);

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => scheduleWhenStable());
        observer.observe(container);
      }

      scheduleWhenStable();

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        observer?.disconnect();
        attachedApi?.removeEventListener?.("columnResized", onColumnResized);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("popstate", onPopState);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, [gridRef]);

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
