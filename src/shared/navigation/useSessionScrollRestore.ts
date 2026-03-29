import { useEffect } from "react";
import type { RefObject } from "react";

type ScrollSnapshot = {
  top: number;
  left: number;
};

function storageKey(key: string): string {
  return `nav-scroll:${key}`;
}

function readSnapshot(key: string): ScrollSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScrollSnapshot> | null;
    if (
      !parsed ||
      typeof parsed.top !== "number" ||
      Number.isNaN(parsed.top) ||
      typeof parsed.left !== "number" ||
      Number.isNaN(parsed.left)
    ) {
      return null;
    }
    return { top: parsed.top, left: parsed.left };
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, snapshot: ScrollSnapshot): void {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(snapshot));
  } catch {
    // ignore session storage failures
  }
}

function resolveScrollTarget(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return (
    root.querySelector<HTMLElement>(".ag-body-viewport") ??
    root.querySelector<HTMLElement>(".ag-center-cols-viewport") ??
    root
  );
}

export function useSessionScrollRestore(
  key: string,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    let cancelled = false;
    let restoreFrame = 0;
    let trackedTarget: HTMLElement | null = null;
    const snapshot = readSnapshot(key);

    const capture = () => {
      if (!trackedTarget) return;
      writeSnapshot(key, {
        top: trackedTarget.scrollTop,
        left: trackedTarget.scrollLeft,
      });
    };

    const attach = () => {
      const target = resolveScrollTarget(containerRef.current);
      if (!target) {
        if (!cancelled) restoreFrame = requestAnimationFrame(attach);
        return;
      }
      trackedTarget = target;
      if (snapshot) {
        target.scrollTop = snapshot.top;
        target.scrollLeft = snapshot.left;
      }
      target.addEventListener("scroll", capture, { passive: true });
    };

    restoreFrame = requestAnimationFrame(attach);

    return () => {
      cancelled = true;
      cancelAnimationFrame(restoreFrame);
      capture();
      trackedTarget?.removeEventListener("scroll", capture);
    };
  }, [key, containerRef]);
}
