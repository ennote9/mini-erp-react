import { exists } from "@tauri-apps/plugin-fs";
import { sanitizeDocumentFilenameBase } from "@/shared/document/documentFilename";

function two(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(now = new Date()): string {
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}

function randomSuffix(len = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizeEmbeddedCode(code?: string): string | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c || undefined;
}

export function buildReadableUniqueFilename(input: {
  base: string;
  extension: string;
  code?: string;
  now?: Date;
}): string {
  const base = sanitizeDocumentFilenameBase(input.base)
    .toLowerCase()
    .replace(/\s+/g, "-");
  const ext = input.extension.replace(/^\./, "").toLowerCase();
  const code = normalizeEmbeddedCode(input.code);
  const core = code ? `${base}_${code}` : base;
  return `${core}_${stamp(input.now)}_${randomSuffix()}.${ext}`;
}

function splitPath(path: string): { dir: string; file: string } {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (idx === -1) return { dir: "", file: path };
  return { dir: path.slice(0, idx + 1), file: path.slice(idx + 1) };
}

function withNewSuffix(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot + 1) : "";
  const noExt = dot >= 0 ? filename.slice(0, dot) : filename;
  const parts = noExt.split("_");
  const suffix = randomSuffix();
  if (parts.length >= 1) {
    parts[parts.length - 1] = suffix;
  }
  const base = parts.join("_");
  return ext ? `${base}.${ext}` : base;
}

/**
 * Ensures collision-safe path: if file exists, retries with a new suffix.
 */
export async function ensureUniqueExportPath(path: string): Promise<string> {
  let candidate = path;
  for (let i = 0; i < 24; i++) {
    const taken = await exists(candidate);
    if (!taken) return candidate;
    const { dir, file } = splitPath(candidate);
    candidate = `${dir}${withNewSuffix(file)}`;
  }
  return candidate;
}

