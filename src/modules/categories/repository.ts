import type { Category } from "./model";

export type CreateCategoryInput = Omit<Category, "id">;
export type UpdateCategoryPatch = Partial<Omit<Category, "id">>;

const store: Category[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
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
    return entity;
  },

  update(id: string, patch: UpdateCategoryPatch): Category | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
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
seed.forEach((s) => categoryRepository.create(s));
