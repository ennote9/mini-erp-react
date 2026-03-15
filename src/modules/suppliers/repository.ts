import type { Supplier } from "./model";

export type CreateSupplierInput = Omit<Supplier, "id">;
export type UpdateSupplierPatch = Partial<Omit<Supplier, "id">>;

const store: Supplier[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
}

export const supplierRepository = {
  list(): Supplier[] {
    return [...store];
  },

  getById(id: string): Supplier | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateSupplierInput): Supplier {
    const entity: Supplier = { ...input, id: nextIdStr() };
    store.push(entity);
    return entity;
  },

  update(id: string, patch: UpdateSupplierPatch): Supplier | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    return store[i];
  },

  search(query: string): Supplier[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

const seed: CreateSupplierInput[] = [
  { code: "SUP-0001", name: "Acme Supplies", isActive: true },
];
seed.forEach((s) => supplierRepository.create(s));
