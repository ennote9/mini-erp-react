import type { Warehouse } from "./model";

export type CreateWarehouseInput = Omit<Warehouse, "id">;
export type UpdateWarehousePatch = Partial<Omit<Warehouse, "id">>;

const store: Warehouse[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
}

export const warehouseRepository = {
  list(): Warehouse[] {
    return [...store];
  },

  getById(id: string): Warehouse | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateWarehouseInput): Warehouse {
    const entity: Warehouse = { ...input, id: nextIdStr() };
    store.push(entity);
    return entity;
  },

  update(id: string, patch: UpdateWarehousePatch): Warehouse | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    return store[i];
  },

  search(query: string): Warehouse[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

const seed: CreateWarehouseInput[] = [
  { code: "WH-001", name: "Main Warehouse", isActive: true },
];
seed.forEach((s) => warehouseRepository.create(s));
