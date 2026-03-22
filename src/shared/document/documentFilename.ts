/** Safe basename segment for user-facing export/download filenames. */

export function sanitizeDocumentFilenameBase(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "document";
}
