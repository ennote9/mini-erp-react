import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Thrown when the raster canvas cannot be exported (e.g. still tainted under WebView2). */
export class PdfRasterExportBlockedError extends Error {
  constructor(message = "PDF_RASTER_EXPORT_BLOCKED") {
    super(message);
    this.name = "PdfRasterExportBlockedError";
  }
}

function isSecurityError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name: string }).name === "SecurityError"
  );
}

function binaryToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function assertCanvasCanExportPixels(source: HTMLCanvasElement): void {
  if (source.width < 1 || source.height < 1) return;
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, 1, 1, 0, 0, 1, 1);
  probe.toDataURL("image/png");
}

async function captureElementToCanvas(
  element: HTMLElement,
  scrollW: number,
  scrollH: number,
  foreignObjectRendering: boolean,
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    /**
     * Must stay false: a tainted canvas cannot be read back via toDataURL/drawImage in Chromium/WebView2,
     * which breaks PDF slicing (see sliceCanvas.toDataURL).
     */
    allowTaint: false,
    foreignObjectRendering,
    logging: import.meta.env.DEV,
    width: scrollW,
    height: scrollH,
    windowWidth: scrollW,
    windowHeight: scrollH,
    scrollX: 0,
    scrollY: 0,
    onclone: (_doc, clonedRoot) => {
      clonedRoot.querySelectorAll("[data-document-export-skip]").forEach((n) => {
        (n as HTMLElement).style.setProperty("display", "none", "important");
      });
    },
  });
}

/**
 * Renders a DOM subtree to a multi-page A4 PDF (image slices) so layout matches on-screen printables.
 */
export async function renderElementToPdfBase64(element: HTMLElement): Promise<string> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const scrollW = Math.max(element.scrollWidth, element.clientWidth);
  const scrollH = Math.max(element.scrollHeight, element.clientHeight);
  if (scrollW < 1 || scrollH < 1) {
    console.error("[pdf] capture: element has no measurable size", { scrollW, scrollH });
    throw new Error("PDF_CAPTURE_EMPTY");
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await captureElementToCanvas(element, scrollW, scrollH, false);
    try {
      assertCanvasCanExportPixels(canvas);
    } catch (e) {
      console.warn("[pdf] canvas not exportable after standard capture, retrying foreignObjectRendering", e);
      canvas = await captureElementToCanvas(element, scrollW, scrollH, true);
      assertCanvasCanExportPixels(canvas);
    }
  } catch (e) {
    console.error("[pdf] html2canvas / export probe failed", e);
    if (isSecurityError(e)) {
      throw new PdfRasterExportBlockedError();
    }
    throw e;
  }

  const pxW = canvas.width;
  const pxH = canvas.height;
  if (pxW < 1 || pxH < 1) {
    console.error("[pdf] html2canvas produced empty canvas", { pxW, pxH });
    throw new Error("PDF_CAPTURE_EMPTY_CANVAS");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginMm = 10;
  const usableW = pageWidth - marginMm * 2;
  const usableH = pageHeight - marginMm * 2;

  const mmPerPx = usableW / pxW;

  let srcY = 0;
  let pageIndex = 0;

  try {
    while (srcY < pxH) {
      const slicePx = Math.min(pxH - srcY, Math.max(1, Math.floor(usableH / mmPerPx)));
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = pxW;
      sliceCanvas.height = slicePx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("PDF_SLICE_CONTEXT_MISSING");
      }
      ctx.drawImage(canvas, 0, srcY, pxW, slicePx, 0, 0, pxW, slicePx);
      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceMmH = slicePx * mmPerPx;

      if (pageIndex > 0) {
        pdf.addPage();
      }
      pdf.addImage(sliceData, "PNG", marginMm, marginMm, usableW, sliceMmH);
      srcY += slicePx;
      pageIndex++;
    }

    const buf = pdf.output("arraybuffer");
    return binaryToBase64(new Uint8Array(buf));
  } catch (e) {
    console.error("[pdf] slice, toDataURL, or jsPDF assembly failed", e);
    if (isSecurityError(e)) {
      throw new PdfRasterExportBlockedError();
    }
    throw e;
  }
}
