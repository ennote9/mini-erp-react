/**
 * JSON persistence for Items under Tauri AppLocalData: items/items.json
 * Image binaries stay in items/<itemId>/images/; only metadata in JSON.
 */
import {
  BaseDirectory,
  mkdir,
  readFile,
  writeFile,
  exists,
  remove,
  rename,
} from "@tauri-apps/plugin-fs";
import type { Item, ItemImage } from "../model";

const BD = BaseDirectory.AppLocalData;
const ITEMS_DIR = "items";
export const ITEMS_JSON_RELATIVE = "items/items.json";
const ITEMS_JSON_TMP = "items/items.json.tmp";

export const ITEMS_PERSIST_VERSION = 1 as const;

export type ItemsPersistedPayload = {
  version: typeof ITEMS_PERSIST_VERSION;
  items: Item[];
};

let lastDiagnostics: string | null = null;

export function getItemsPersistenceDiagnostics(): string | null {
  return lastDiagnostics;
}

function setDiagnostics(msg: string | null): void {
  lastDiagnostics = msg;
  if (import.meta.env.DEV && msg) {
    console.warn("[itemsPersistence]", msg);
  }
}

function computeNextNumericId(items: Item[]): number {
  let max = 0;
  for (const it of items) {
    const n = Number.parseInt(it.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function normalizeItemImage(raw: unknown): ItemImage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const fileName = o.fileName;
  const relativePath = o.relativePath;
  if (typeof id !== "string" || typeof fileName !== "string" || typeof relativePath !== "string") return null;
  if (!relativePath.startsWith("items/") || relativePath.includes("..")) return null;
  const mimeType = typeof o.mimeType === "string" ? o.mimeType : "application/octet-stream";
  const sizeBytes = typeof o.sizeBytes === "number" && !Number.isNaN(o.sizeBytes) ? o.sizeBytes : 0;
  const sortOrder = typeof o.sortOrder === "number" && !Number.isNaN(o.sortOrder) ? o.sortOrder : 0;
  const isPrimary = typeof o.isPrimary === "boolean" ? o.isPrimary : false;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString();
  const width = typeof o.width === "number" && !Number.isNaN(o.width) ? o.width : undefined;
  const height = typeof o.height === "number" && !Number.isNaN(o.height) ? o.height : undefined;
  return {
    id,
    fileName,
    relativePath,
    mimeType,
    sizeBytes,
    width,
    height,
    sortOrder,
    isPrimary,
    createdAt,
  };
}

function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.code !== "string" || typeof o.name !== "string") return null;
  if (typeof o.uom !== "string") return null;
  if (typeof o.isActive !== "boolean") return null;
  const imagesRaw = o.images;
  const images: ItemImage[] = Array.isArray(imagesRaw)
    ? (imagesRaw.map(normalizeItemImage).filter((x): x is ItemImage => x !== null))
    : [];
  const description = typeof o.description === "string" ? o.description : undefined;
  const brandId = typeof o.brandId === "string" ? o.brandId : undefined;
  const categoryId = typeof o.categoryId === "string" ? o.categoryId : undefined;
  const barcode = typeof o.barcode === "string" ? o.barcode : undefined;
  const purchasePrice =
    typeof o.purchasePrice === "number" && !Number.isNaN(o.purchasePrice) ? o.purchasePrice : undefined;
  const salePrice = typeof o.salePrice === "number" && !Number.isNaN(o.salePrice) ? o.salePrice : undefined;
  return {
    id: o.id,
    code: o.code,
    name: o.name,
    uom: o.uom,
    isActive: o.isActive,
    description,
    brandId,
    categoryId,
    barcode,
    purchasePrice,
    salePrice,
    images,
  };
}

type ParseResult =
  | { ok: true; items: Item[] }
  | { ok: false; reason: "json" | "shape" | "empty_valid" };

function parseItemsFileContent(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!data || typeof data !== "object") return { ok: false, reason: "shape" };
  const rec = data as Record<string, unknown>;
  if (rec.version !== ITEMS_PERSIST_VERSION) return { ok: false, reason: "shape" };
  const itemsRaw = rec.items;
  if (!Array.isArray(itemsRaw)) return { ok: false, reason: "shape" };
  const items = itemsRaw.map(normalizeItem).filter((x): x is Item => x !== null);
  if (items.length === 0 && itemsRaw.length > 0) return { ok: false, reason: "empty_valid" };
  return { ok: true, items };
}

async function archiveCorruptMainFile(): Promise<void> {
  const corruptName = `${ITEMS_DIR}/items.corrupt.${Date.now()}.json`;
  await rename(ITEMS_JSON_RELATIVE, corruptName, { oldPathBaseDir: BD, newPathBaseDir: BD });
}

/**
 * Write UTF-8 JSON via temp file, then replace main.
 *
 * Remaining risk (unchanged): this is not a single atomic OS operation. If the process
 * terminates after `remove(items.json)` but before `rename(tmp → items.json)` completes,
 * the main file can be missing until the next successful write. Forced kill / power loss
 * in that window can still lose the last snapshot; normal close is mitigated via flush on
 * window close in the Items repository.
 */
export async function writeItemsPayload(items: Item[]): Promise<void> {
  const payload: ItemsPersistedPayload = { version: ITEMS_PERSIST_VERSION, items };
  const json = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(json);
  await mkdir(ITEMS_DIR, { recursive: true, baseDir: BD });
  await writeFile(ITEMS_JSON_TMP, bytes, { baseDir: BD });
  const mainExists = await exists(ITEMS_JSON_RELATIVE, { baseDir: BD });
  if (mainExists) {
    await remove(ITEMS_JSON_RELATIVE, { baseDir: BD });
  }
  await rename(ITEMS_JSON_TMP, ITEMS_JSON_RELATIVE, { oldPathBaseDir: BD, newPathBaseDir: BD });
}

export type ItemsLoadResult = {
  items: Item[];
  nextId: number;
};

/**
 * Load items from disk or bootstrap from seed. Does not mutate caller state.
 * On non-Tauri / FS failure: returns in-memory seed only (no throw).
 */
export async function loadItemsPersisted(buildSeedItems: () => Item[]): Promise<ItemsLoadResult> {
  setDiagnostics(null);
  try {
    await mkdir(ITEMS_DIR, { recursive: true, baseDir: BD });
    const fileExists = await exists(ITEMS_JSON_RELATIVE, { baseDir: BD });
    if (!fileExists) {
      const seed = buildSeedItems();
      try {
        await writeItemsPayload(seed);
      } catch (w) {
        const msg = w instanceof Error ? w.message : String(w);
        setDiagnostics(`First-run persist failed (using in-memory seed): ${msg}`);
      }
      return { items: seed, nextId: computeNextNumericId(seed) };
    }

    const bytes = await readFile(ITEMS_JSON_RELATIVE, { baseDir: BD });
    const text = new TextDecoder().decode(bytes);
    const parsed = parseItemsFileContent(text);
    if (!parsed.ok) {
      if (import.meta.env.DEV) {
        setDiagnostics(`items.json unreadable (${parsed.reason}); archived and re-seeded.`);
      } else {
        setDiagnostics("Saved items file was invalid; restored defaults from seed.");
      }
      try {
        await archiveCorruptMainFile();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setDiagnostics(`Could not archive corrupt items.json: ${msg}`);
      }
      const seed = buildSeedItems();
      try {
        await writeItemsPayload(seed);
      } catch (w) {
        const msg = w instanceof Error ? w.message : String(w);
        setDiagnostics(`Re-seed write failed: ${msg}`);
      }
      return { items: seed, nextId: computeNextNumericId(seed) };
    }

    return { items: parsed.items, nextId: computeNextNumericId(parsed.items) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setDiagnostics(`Items load failed (in-memory seed only): ${msg}`);
    const seed = buildSeedItems();
    return { items: seed, nextId: computeNextNumericId(seed) };
  }
}
