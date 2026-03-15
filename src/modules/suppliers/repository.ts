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
  { code: "SUP-0001", name: "Acme Supplies", isActive: true, phone: "+1 555 201 1001", email: "orders@acmesupplies.com" },
  { code: "SUP-0002", name: "Northern Steel Co", isActive: true, phone: "+1 555 202 1002", email: "sales@northernsteel.com" },
  { code: "SUP-0003", name: "Pacific Fasteners Ltd", isActive: true, phone: "+1 555 203 1003", email: "info@pacificfasteners.com" },
  { code: "SUP-0004", name: "Midwest Bearings Inc", isActive: true, phone: "+1 555 204 1004", email: "inquiry@midwestbearings.com" },
  { code: "SUP-0005", name: "Eastern Gasket Supply", isActive: true, phone: "+1 555 205 1005", email: "orders@easterngasket.com" },
  { code: "SUP-0006", name: "Central Hydraulics", isActive: true, phone: "+1 555 206 1006", email: "sales@centralhydraulics.com" },
  { code: "SUP-0007", name: "Summit Electronics", isActive: true, phone: "+1 555 207 1007", email: "procurement@summitelectronics.com" },
  { code: "SUP-0008", name: "Valley Industrial Supply", isActive: true, phone: "+1 555 208 1008", email: "contact@valleyindustrial.com" },
  { code: "SUP-0009", name: "Riverside Packaging", isActive: true, phone: "+1 555 209 1009", email: "orders@riversidepackaging.com" },
  { code: "SUP-0010", name: "Metro Tool & Die", isActive: true, phone: "+1 555 210 1010", email: "sales@metrotool.com" },
  { code: "SUP-0011", name: "Great Lakes Chemicals", isActive: true, phone: "+1 555 211 1011", email: "info@greatlakeschem.com" },
  { code: "SUP-0012", name: "Plains Rubber Co", isActive: true, phone: "+1 555 212 1012", email: "orders@plainsrubber.com" },
  { code: "SUP-0013", name: "Coastal Wire & Cable", isActive: true, phone: "+1 555 213 1013", email: "sales@coastalwire.com" },
  { code: "SUP-0014", name: "Highland Motors Inc", isActive: true, phone: "+1 555 214 1014", email: "parts@highlandmotors.com" },
  { code: "SUP-0015", name: "Delta Filters Ltd", isActive: true, phone: "+1 555 215 1015", email: "inquiry@deltafilters.com" },
  { code: "SUP-0016", name: "Atlas Casting Works", isActive: true, phone: "+1 555 216 1016", email: "orders@atlascasting.com" },
  { code: "SUP-0017", name: "Pioneer Lubricants", isActive: true, phone: "+1 555 217 1017", email: "sales@pioneerlubricants.com" },
  { code: "SUP-0018", name: "Sterling Bolts & Nuts", isActive: true, phone: "+1 555 218 1018", email: "contact@sterlingbolts.com" },
  { code: "SUP-0019", name: "Cascade Sensors", isActive: true, phone: "+1 555 219 1019", email: "support@cascadesensors.com" },
  { code: "SUP-0020", name: "Twin Cities Plastics", isActive: true, phone: "+1 555 220 1020", email: "orders@twincitiesplastics.com" },
  { code: "SUP-0021", name: "Sunrise Components", isActive: true, email: "procurement@sunrisecomponents.com" },
  { code: "SUP-0022", name: "Heritage Metal Works", isActive: true, phone: "+1 555 222 1022", email: "sales@heritagemetal.com" },
  { code: "SUP-0023", name: "Former Partner Corp", isActive: false, phone: "+1 555 223 1023", email: "legacy@formerpartner.com" },
  { code: "SUP-0024", name: "Inactive Vendor Ltd", isActive: false },
  { code: "SUP-0025", name: "Prime MRO Supply", isActive: true, phone: "+1 555 225 1025", email: "orders@primemro.com" },
];
seed.forEach((s) => supplierRepository.create(s));
