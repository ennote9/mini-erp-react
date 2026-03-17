import type { Brand } from "./model";

export type CreateBrandInput = Omit<Brand, "id">;
export type UpdateBrandPatch = Partial<Omit<Brand, "id">>;

const store: Brand[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
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
    return entity;
  },

  update(id: string, patch: UpdateBrandPatch): Brand | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
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
seed.forEach((s) => brandRepository.create(s));
