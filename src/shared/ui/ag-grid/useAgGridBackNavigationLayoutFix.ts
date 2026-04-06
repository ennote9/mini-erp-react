import { useEffect } from "react";
import type { RefObject } from "react";
import type { AgGridReact } from "ag-grid-react";

type AnyGridApi = {
  doLayout?: () => void;
  refreshHeader?: () => void;
};

/**
 * Fixes occasional AG Grid header/body misalignment after browser-back restoration.
 * Runs a lightweight re-layout when the grid container has a stable non-zero size.
 */
export function useAgGridBackNavigationLayoutFix<TData>(
  gridRef: RefObject<AgGridReact<TData> | null>,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let observer: ResizeObserver | null = null;

    const runLayout = () => {
      const api = (gridRef.current?.api as AnyGridApi | undefined) ?? null;
      if (!api) return;
      api.doLayout?.();
      api.refreshHeader?.();
      requestAnimationFrame(() => {
        const apiAfterFrame = (gridRef.current?.api as AnyGridApi | undefined) ?? null;
        apiAfterFrame?.doLayout?.();
        apiAfterFrame?.refreshHeader?.();
      });
    };

    const scheduleWhenStable = () => {
      cancelAnimationFrame(rafId);
      let attempts = 0;
      let prevW = -1;
      let prevH = -1;
      let stableFrames = 0;

      const tick = () => {
        if (cancelled) return;
        attempts += 1;

        const container = containerRef.current;
        const api = gridRef.current?.api;
        if (!container || !api) {
          if (attempts < 24) rafId = requestAnimationFrame(tick);
          return;
        }

        const rect = container.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (width <= 0 || height <= 0) {
          if (attempts < 24) rafId = requestAnimationFrame(tick);
          return;
        }

        if (width === prevW && height === prevH) stableFrames += 1;
        else stableFrames = 0;
        prevW = width;
        prevH = height;

        if (stableFrames >= 1 || attempts >= 10) {
          runLayout();
          return;
        }

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    };

    const onPageShow = () => scheduleWhenStable();
    const onPopState = () => scheduleWhenStable();
    const onResize = () => scheduleWhenStable();
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleWhenStable();
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => scheduleWhenStable());
      if (containerRef.current) observer.observe(containerRef.current);
    }

    scheduleWhenStable();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gridRef, containerRef]);
}

