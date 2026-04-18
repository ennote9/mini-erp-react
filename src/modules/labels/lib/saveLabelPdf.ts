import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { buildReadableUniqueFilename, ensureUniqueExportPath } from "@/shared/export/filenameBuilder";

function binaryToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Rasterizes the label DOM (same surface as on-screen preview) and builds a compact PDF in real mm size.
 * Reuses html2canvas + jsPDF like {@link renderElementToPdfBase64}, but one page per copy at label dimensions.
 */
export async function buildLabelPdfBytes(
  element: HTMLElement,
  sizeMm: { width: number; height: number },
  copies: number,
): Promise<Uint8Array> {
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
    throw new Error("LABEL_PDF_EMPTY_SURFACE");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    foreignObjectRendering: false,
    logging: import.meta.env.DEV,
    width: scrollW,
    height: scrollH,
    windowWidth: scrollW,
    windowHeight: scrollH,
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/png");
  const wMm = sizeMm.width;
  const hMm = sizeMm.height;
  const orientation = wMm >= hMm ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: [wMm, hMm],
  });

  const n = Math.max(1, Math.min(999, copies));
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      pdf.addPage([wMm, hMm], orientation);
    }
    pdf.addImage(imgData, "PNG", 0, 0, wMm, hMm);
  }

  const buf = pdf.output("arraybuffer");
  return new Uint8Array(buf);
}

/**
 * Saves label PDF via Tauri dialog + `write_export_file`, or triggers a browser download when not in Tauri.
 */
export async function saveLabelPdf(options: {
  element: HTMLElement;
  sizeMm: { width: number; height: number };
  copies: number;
  filenameBase: string;
}): Promise<{ path?: string; filename: string }> {
  const bytes = await buildLabelPdfBytes(options.element, options.sizeMm, options.copies);
  const defaultFilename = buildReadableUniqueFilename({
    base: options.filenameBase.replace(/\.pdf$/i, ""),
    extension: "pdf",
  });

  if (!isTauriRuntime()) {
    downloadPdfBytes(bytes, defaultFilename);
    return { filename: defaultFilename };
  }

  const path = await save({
    defaultPath: defaultFilename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (path == null) {
    downloadPdfBytes(bytes, defaultFilename);
    return { filename: defaultFilename };
  }

  const safePath = await ensureUniqueExportPath(path);
  const contentsBase64 = binaryToBase64(bytes);
  await invoke("write_export_file", { path: safePath, contentsBase64 });
  const filename = safePath.replace(/^.*[/\\]/, "") || defaultFilename;
  return { path: safePath, filename };
}
