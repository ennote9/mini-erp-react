import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  buildReadableUniqueFilename,
  ensureUniqueExportPath,
} from "@/shared/export/filenameBuilder";
import { sanitizeDocumentFilenameBase } from "./documentFilename";
import { renderElementToPdfBase64 } from "./renderElementToPdf";
import { PdfWriteFailedError } from "./savePdfFile";

function isNativePdfUnsupported(err: unknown): boolean {
  const s =
    typeof err === "string"
      ? err
      : err != null && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  return s.includes("NATIVE_PDF_UNSUPPORTED");
}

/**
 * Saves a printable document as PDF.
 * On Windows: WebView2 `PrintToPdf` (no JS canvas) after `@media print` hides app chrome.
 * On other platforms: falls back to raster html2canvas + jsPDF + `write_export_file` when native is unavailable.
 */
export async function savePrintableDocumentPdf(options: {
  root: HTMLElement | null;
  defaultFilename: string;
  filterName: string;
}): Promise<{ path: string; filename: string } | null> {
  const base = sanitizeDocumentFilenameBase(options.defaultFilename.replace(/\.pdf$/i, ""));
  const defaultPath = buildReadableUniqueFilename({ base, extension: "pdf" });

  const path = await save({
    defaultPath,
    filters: [{ name: options.filterName, extensions: ["pdf"] }],
  });
  if (path == null) return null;
  const safePath = await ensureUniqueExportPath(path);

  try {
    await invoke("webview_print_to_pdf", { path: safePath });
    const filename = safePath.replace(/^.*[/\\]/, "") || defaultPath;
    return { path: safePath, filename };
  } catch (err) {
    if (options.root && isNativePdfUnsupported(err)) {
      const contentsBase64 = await renderElementToPdfBase64(options.root);
      try {
        await invoke("write_export_file", { path: safePath, contentsBase64 });
      } catch (writeErr) {
        console.error("[pdf] write_export_file failed (fallback)", writeErr);
        throw new PdfWriteFailedError();
      }
      const filename = safePath.replace(/^.*[/\\]/, "") || defaultPath;
      return { path: safePath, filename };
    }
    throw err;
  }
}
