/** Thrown when `write_export_file` fails (e.g. raster PDF fallback on non-Windows). */
export class PdfWriteFailedError extends Error {
  constructor() {
    super("PDF_WRITE_FAILED");
    this.name = "PdfWriteFailedError";
  }
}
