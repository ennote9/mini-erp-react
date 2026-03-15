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
  { code: "WH-002", name: "North Distribution Center", isActive: true },
  { code: "WH-003", name: "South Distribution Center", isActive: true },
  { code: "WH-004", name: "East Coast Hub", isActive: true },
  { code: "WH-005", name: "West Coast Hub", isActive: true },
  { code: "WH-006", name: "Central Staging", isActive: true },
  { code: "WH-007", name: "Receiving Dock A", isActive: true },
  { code: "WH-008", name: "Receiving Dock B", isActive: true },
  { code: "WH-009", name: "Finished Goods Store", isActive: true },
  { code: "WH-010", name: "Raw Materials Store", isActive: true },
  { code: "WH-011", name: "Spare Parts Warehouse", isActive: true },
  { code: "WH-012", name: "Quarantine Area", isActive: true },
  { code: "WH-013", name: "Returns & RMA", isActive: true },
  { code: "WH-014", name: "Cold Storage", isActive: true },
  { code: "WH-015", name: "High-Value Secure", isActive: true },
  { code: "WH-016", name: "Assembly Line Feed", isActive: true },
  { code: "WH-017", name: "Shipping Prep Zone", isActive: true },
  { code: "WH-018", name: "Overflow Storage", isActive: true },
  { code: "WH-019", name: "Regional Depot 1", isActive: true },
  { code: "WH-020", name: "Regional Depot 2", isActive: true },
  { code: "WH-021", name: "Consignment Store", isActive: true },
  { code: "WH-022", name: "Third-Party Logistics", isActive: true },
  { code: "WH-023", name: "Legacy Warehouse", isActive: false },
  { code: "WH-024", name: "Decommissioned Site", isActive: false },
  { code: "WH-025", name: "Cross-Dock Terminal", isActive: true },
];
seed.forEach((s) => warehouseRepository.create(s));
