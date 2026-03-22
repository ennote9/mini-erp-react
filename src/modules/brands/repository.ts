import type { Brand } from "./model";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

export type CreateBrandInput = Omit<Brand, "id">;
export type UpdateBrandPatch = Partial<Omit<Brand, "id">>;

const store: Brand[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("brands.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function normalizeBrand(raw: unknown): Brand | null {
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

function buildSeedBrands(): Brand[] {
  return seed.map((s, i) => ({ ...s, id: String(i + 1) }));
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMasterDataPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[brandRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getBrandPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingBrandPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedBrands,
    normalizeRecord: normalizeBrand,
    diagnosticsTag: "brandRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const brandRepository = {
  list(): Brand[] {
    return [...store];
  },

  getById(id: string): Brand | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateBrandInput): Brand {
    const entity: Brand = { ...input, id: nextIdStr() };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateBrandPatch): Brand | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
    return store[i];
  },

  search(query: string): Brand[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

// Seed brands used by item seed (codes match mapping in items/repository)
const seed: CreateBrandInput[] = [
  { code: "ACME", name: "Acme", isActive: true },
  { code: "METALWORKS", name: "MetalWorks", isActive: true },
  { code: "SEALPRO", name: "SealPro", isActive: true },
  { code: "BOLTCO", name: "BoltCo", isActive: true },
  { code: "LUBEMAX", name: "LubeMax", isActive: true },
  { code: "FILTERTECH", name: "FilterTech", isActive: true },
  { code: "DRIVEPARTS", name: "DriveParts", isActive: true },
  { code: "ELECTROLOGIC", name: "ElectroLogic", isActive: true },
  { code: "DISPLAYTECH", name: "DisplayTech", isActive: true },
];

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "brands",
  flush: flushPendingBrandPersist,
  isBusy: getBrandPersistBusy,
});
