import type { Warehouse } from "./model";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

export type CreateWarehouseInput = Omit<Warehouse, "id">;
export type UpdateWarehousePatch = Partial<Omit<Warehouse, "id">>;

const store: Warehouse[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("warehouses.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function normalizeWarehouse(raw: unknown): Warehouse | null {
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
    warehouseType: asOptionalString(rec.warehouseType),
    address: asOptionalString(rec.address),
    city: asOptionalString(rec.city),
    country: asOptionalString(rec.country),
    contactPerson: asOptionalString(rec.contactPerson),
    phone: asOptionalString(rec.phone),
  };
}

function buildSeedWarehouses(): Warehouse[] {
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
          console.error("[warehouseRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getWarehousePersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingWarehousePersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedWarehouses,
    normalizeRecord: normalizeWarehouse,
    diagnosticsTag: "warehouseRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
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
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateWarehousePatch): Warehouse | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
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
  { code: "WH-001", name: "Main Warehouse", isActive: true, warehouseType: "Main", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0100" },
  { code: "WH-002", name: "North Distribution Center", isActive: true, warehouseType: "Distribution", address: "200 Logistics Way", city: "Minneapolis", country: "USA", contactPerson: "Jane Doe", phone: "+1 612 555 0200" },
  { code: "WH-003", name: "South Distribution Center", isActive: true, warehouseType: "Distribution", address: "300 Commerce Dr", city: "Dallas", country: "USA", contactPerson: "Bob Wilson", phone: "+1 214 555 0300" },
  { code: "WH-004", name: "East Coast Hub", isActive: true, warehouseType: "Hub", address: "400 Harbor Rd", city: "Newark", country: "USA", contactPerson: "Alice Brown", phone: "+1 973 555 0400" },
  { code: "WH-005", name: "West Coast Hub", isActive: true, warehouseType: "Hub", address: "500 Port Ave", city: "Los Angeles", country: "USA", contactPerson: "Carlos Garcia", phone: "+1 310 555 0500" },
  { code: "WH-006", name: "Central Staging", isActive: true, warehouseType: "Staging", address: "600 Warehouse Ln", city: "Kansas City", country: "USA", contactPerson: "Mary Lee", phone: "+1 816 555 0600" },
  { code: "WH-007", name: "Receiving Dock A", isActive: true, warehouseType: "Receiving", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0101" },
  { code: "WH-008", name: "Receiving Dock B", isActive: true, warehouseType: "Receiving", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0102" },
  { code: "WH-009", name: "Finished Goods Store", isActive: true, warehouseType: "Storage", address: "700 Production Pkwy", city: "Detroit", country: "USA", contactPerson: "Tom Clark", phone: "+1 313 555 0900" },
  { code: "WH-010", name: "Raw Materials Store", isActive: true, warehouseType: "Storage", address: "700 Production Pkwy", city: "Detroit", country: "USA", contactPerson: "Tom Clark", phone: "+1 313 555 0910" },
  { code: "WH-011", name: "Spare Parts Warehouse", isActive: true, warehouseType: "Storage", address: "800 Service Rd", city: "Cleveland", country: "USA", contactPerson: "Pat Miller", phone: "+1 216 555 1100" },
  { code: "WH-012", name: "Quarantine Area", isActive: true, warehouseType: "Quality", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0103" },
  { code: "WH-013", name: "Returns & RMA", isActive: true, warehouseType: "Returns", address: "900 Returns Ct", city: "Indianapolis", country: "USA", contactPerson: "Sam Davis", phone: "+1 317 555 1300" },
  { code: "WH-014", name: "Cold Storage", isActive: true, warehouseType: "Cold", address: "1000 Chill Way", city: "Milwaukee", country: "USA", contactPerson: "Chris Evans", phone: "+1 414 555 1400" },
  { code: "WH-015", name: "High-Value Secure", isActive: true, warehouseType: "Secure", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0104" },
  { code: "WH-016", name: "Assembly Line Feed", isActive: true, warehouseType: "Production", address: "700 Production Pkwy", city: "Detroit", country: "USA", contactPerson: "Tom Clark", phone: "+1 313 555 0915" },
  { code: "WH-017", name: "Shipping Prep Zone", isActive: true, warehouseType: "Shipping", address: "100 Industrial Blvd", city: "Chicago", country: "USA", contactPerson: "John Smith", phone: "+1 312 555 0105" },
  { code: "WH-018", name: "Overflow Storage", isActive: true, warehouseType: "Storage", address: "600 Warehouse Ln", city: "Kansas City", country: "USA", contactPerson: "Mary Lee", phone: "+1 816 555 0601" },
  { code: "WH-019", name: "Regional Depot 1", isActive: true, warehouseType: "Depot", address: "1100 Regional Hwy", city: "Denver", country: "USA", contactPerson: "Rick Taylor", phone: "+1 303 555 1900" },
  { code: "WH-020", name: "Regional Depot 2", isActive: true, warehouseType: "Depot", address: "1200 Regional Hwy", city: "Phoenix", country: "USA", contactPerson: "Nancy White", phone: "+1 602 555 2000" },
  { code: "WH-021", name: "Consignment Store", isActive: true, warehouseType: "Consignment", address: "1300 Partner Blvd", city: "Seattle", country: "USA", contactPerson: "Frank Moore", phone: "+1 206 555 2100" },
  { code: "WH-022", name: "Third-Party Logistics", isActive: true, warehouseType: "3PL", address: "1400 3PL Way", city: "Atlanta", country: "USA", contactPerson: "Lisa Green", phone: "+1 404 555 2200" },
  { code: "WH-023", name: "Legacy Warehouse", isActive: false, warehouseType: "Legacy", address: "1500 Old Site Rd", city: "St. Louis", country: "USA", contactPerson: "Retired", phone: "" },
  { code: "WH-024", name: "Decommissioned Site", isActive: false, warehouseType: "Decommissioned", address: "1600 Closed Ln", city: "Pittsburgh", country: "USA", contactPerson: "", phone: "" },
  { code: "WH-025", name: "Cross-Dock Terminal", isActive: true, warehouseType: "Cross-dock", address: "400 Harbor Rd", city: "Newark", country: "USA", contactPerson: "Alice Brown", phone: "+1 973 555 0401" },
];

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "warehouses",
  flush: flushPendingWarehousePersist,
  isBusy: getWarehousePersistBusy,
});
