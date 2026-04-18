const PORTAL_ID = "label-print-portal";
const DYNAMIC_STYLE_ID = "label-print-dynamic-page";

export type PrintLabelSurfaceOptions = {
  sourceElement: HTMLElement;
  sizeMm: { width: number; height: number };
  copies: number;
};

export type BatchPrintLabelSegment = PrintLabelSurfaceOptions;

/**
 * Opens the system print dialog for cloned label DOM (same pixels as on-screen preview).
 * Resolves after the print dialog closes (`afterprint`). Does not confirm physical printer output.
 */
export function printLabelSurface(options: PrintLabelSurfaceOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const portal = document.getElementById(PORTAL_ID);
    if (!portal) {
      reject(new Error("LABEL_PRINT_PORTAL_MISSING"));
      return;
    }

    const w = options.sizeMm.width;
    const h = options.sizeMm.height;
    const n = Math.max(1, Math.min(999, options.copies));

    document.getElementById(DYNAMIC_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = DYNAMIC_STYLE_ID;
    style.textContent = `
      @page { size: ${w}mm ${h}mm; margin: 0; }
      .label-print-sheet {
        width: ${w}mm;
        height: ${h}mm;
        page-break-after: always;
        box-sizing: border-box;
        overflow: hidden;
      }
      .label-print-sheet:last-of-type { page-break-after: auto; }
    `;
    document.head.appendChild(style);

    portal.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const sheet = document.createElement("div");
      sheet.className = "label-print-sheet";
      sheet.appendChild(options.sourceElement.cloneNode(true) as HTMLElement);
      portal.appendChild(sheet);
    }

    const cleanup = () => {
      portal.innerHTML = "";
      style.remove();
      document.body.classList.remove("labels-direct-print");
      window.removeEventListener("afterprint", onAfterPrint);
    };

    const onAfterPrint = () => {
      cleanup();
      resolve();
    };

    window.addEventListener("afterprint", onAfterPrint);
    document.body.classList.add("labels-direct-print");

    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (e) {
        cleanup();
        window.removeEventListener("afterprint", onAfterPrint);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

/**
 * Prints multiple label surfaces in order: each segment’s `copies` clone appended to the print portal.
 * All segments must share the same `@page` size (MVP: single batch template).
 */
export function printBatchLabelSurfaces(segments: BatchPrintLabelSegment[]): Promise<void> {
  if (segments.length === 0) {
    return Promise.reject(new Error("BATCH_PRINT_EMPTY"));
  }
  const w = segments[0].sizeMm.width;
  const h = segments[0].sizeMm.height;
  for (const s of segments) {
    if (s.sizeMm.width !== w || s.sizeMm.height !== h) {
      return Promise.reject(new Error("BATCH_PRINT_SIZE_MISMATCH"));
    }
  }

  return new Promise((resolve, reject) => {
    const portal = document.getElementById(PORTAL_ID);
    if (!portal) {
      reject(new Error("LABEL_PRINT_PORTAL_MISSING"));
      return;
    }

    document.getElementById(DYNAMIC_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = DYNAMIC_STYLE_ID;
    style.textContent = `
      @page { size: ${w}mm ${h}mm; margin: 0; }
      .label-print-sheet {
        width: ${w}mm;
        height: ${h}mm;
        page-break-after: always;
        box-sizing: border-box;
        overflow: hidden;
      }
      .label-print-sheet:last-of-type { page-break-after: auto; }
    `;
    document.head.appendChild(style);

    portal.innerHTML = "";
    let totalSheets = 0;
    for (const seg of segments) {
      const n = Math.max(1, Math.min(999, seg.copies));
      for (let i = 0; i < n; i++) {
        const sheet = document.createElement("div");
        sheet.className = "label-print-sheet";
        sheet.appendChild(seg.sourceElement.cloneNode(true) as HTMLElement);
        portal.appendChild(sheet);
        totalSheets++;
      }
    }
    if (totalSheets === 0) {
      style.remove();
      reject(new Error("BATCH_PRINT_EMPTY"));
      return;
    }

    const cleanup = () => {
      portal.innerHTML = "";
      style.remove();
      document.body.classList.remove("labels-direct-print");
      window.removeEventListener("afterprint", onAfterPrint);
    };

    const onAfterPrint = () => {
      cleanup();
      resolve();
    };

    window.addEventListener("afterprint", onAfterPrint);
    document.body.classList.add("labels-direct-print");

    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (e) {
        cleanup();
        window.removeEventListener("afterprint", onAfterPrint);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}
