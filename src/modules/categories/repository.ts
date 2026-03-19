import type { Category } from "./model";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";

export type CreateCategoryInput = Omit<Category, "id">;
export type UpdateCategoryPatch = Partial<Omit<Category, "id">>;

const store: Category[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("categories.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function normalizeCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (
    typeof rec.id !== "string" ||
    typeof rec.code !== "string" ||
    typeof rec.name !== "string" ||
    typeof rec.isActive !== "boolean"
  ) {
    return null;
  }
  return {
    id: rec.id,
    code: rec.code,
    name: rec.name,
    isActive: rec.isActive,
    comment: asOptionalString(rec.comment),
  };
}

function buildSeedCategories(): Category[] {
  return seed.map((s, i) => ({ ...s, id: String(i + 1) }));
}

function schedulePersist(): void {
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMasterDataPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[categoryRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getCategoryPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingCategoryPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedCategories,
    normalizeRecord: normalizeCategory,
    diagnosticsTag: "categoryRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const categoryRepository = {
  list(): Category[] {
    return [...store];
  },

  getById(id: string): Category | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateCategoryInput): Category {
    const entity: Category = { ...input, id: nextIdStr() };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateCategoryPatch): Category | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
    return store[i];
  },

  search(query: string): Category[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

// Seed categories used by item seed (codes match mapping in items/repository)
const seed: CreateCategoryInput[] = [
  { code: "COMPONENTS", name: "Components", isActive: true },
  { code: "HARDWARE", name: "Hardware", isActive: true },
  { code: "KITS", name: "Kits", isActive: true },
  { code: "SEALS", name: "Seals", isActive: true },
  { code: "FASTENERS", name: "Fasteners", isActive: true },
  { code: "CONSUMABLES", name: "Consumables", isActive: true },
  { code: "FILTERS", name: "Filters", isActive: true },
  { code: "TRANSMISSION", name: "Transmission", isActive: true },
  { code: "ELECTRONICS", name: "Electronics", isActive: true },
  { code: "SENSORS", name: "Sensors", isActive: true },
  { code: "CABLES", name: "Cables", isActive: true },
];

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "categories",
  flush: flushPendingCategoryPersist,
  isBusy: getCategoryPersistBusy,
});
