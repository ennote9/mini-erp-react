import type { Customer } from "./model";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";

export type CreateCustomerInput = Omit<Customer, "id">;
export type UpdateCustomerPatch = Partial<Omit<Customer, "id">>;

const store: Customer[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("customers.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asOptionalTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function normalizeCustomer(raw: unknown): Customer | null {
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
    phone: asOptionalString(rec.phone),
    email: asOptionalString(rec.email),
    comment: asOptionalString(rec.comment),
    contactPerson: asOptionalString(rec.contactPerson),
    taxId: asOptionalString(rec.taxId),
    billingAddress: asOptionalString(rec.billingAddress),
    shippingAddress: asOptionalString(rec.shippingAddress),
    city: asOptionalString(rec.city),
    country: asOptionalString(rec.country),
    paymentTermsDays: asOptionalNumber(rec.paymentTermsDays),
    preferredCarrierId: asOptionalTrimmedString(rec.preferredCarrierId),
    defaultRecipientName: asOptionalTrimmedString(rec.defaultRecipientName),
    defaultRecipientPhone: asOptionalTrimmedString(rec.defaultRecipientPhone),
    defaultDeliveryAddress: asOptionalTrimmedString(rec.defaultDeliveryAddress),
    defaultDeliveryComment: asOptionalTrimmedString(rec.defaultDeliveryComment),
  };
}

function buildSeedCustomers(): Customer[] {
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
          console.error("[customerRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getCustomerPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingCustomerPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedCustomers,
    normalizeRecord: normalizeCustomer,
    diagnosticsTag: "customerRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const customerRepository = {
  list(): Customer[] {
    return [...store];
  },

  getById(id: string): Customer | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateCustomerInput): Customer {
    const entity: Customer = { ...input, id: nextIdStr() };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateCustomerPatch): Customer | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
    return store[i];
  },

  search(query: string): Customer[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
    );
  },
};

const seed: CreateCustomerInput[] = [
  { code: "CUS-0001", name: "Beta Corp", isActive: true, phone: "+1 555 301 2001", email: "purchasing@betacorp.com", contactPerson: "Jane Smith", taxId: "12-3456789", billingAddress: "100 Industrial Blvd", shippingAddress: "100 Industrial Blvd", city: "Chicago", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0002", name: "Gamma Industries", isActive: true, phone: "+1 555 302 2002", email: "procurement@gammaind.com", contactPerson: "Mike Johnson", taxId: "98-7654321", billingAddress: "200 Commerce Dr", shippingAddress: "200 Commerce Dr", city: "Detroit", country: "USA", paymentTermsDays: 45 },
  { code: "CUS-0003", name: "Delta Manufacturing LLC", isActive: true, phone: "+1 555 303 2003", email: "orders@deltamfg.com", contactPerson: "Sarah Lee", taxId: "11-2223334", billingAddress: "50 Factory Lane", shippingAddress: "50 Factory Lane", city: "Cleveland", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0004", name: "Epsilon Systems", isActive: true, phone: "+1 555 304 2004", email: "sales-contact@epsilonsys.com", contactPerson: "David Chen", taxId: "55-6667778", billingAddress: "300 Tech Park", shippingAddress: "300 Tech Park", city: "Austin", country: "USA", paymentTermsDays: 14 },
  { code: "CUS-0005", name: "Zeta Logistics Inc", isActive: true, phone: "+1 555 305 2005", email: "supply@zetalogistics.com", contactPerson: "Anna Brown", taxId: "77-8889990", billingAddress: "400 Warehouse Rd", shippingAddress: "400 Warehouse Rd", city: "Dallas", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0006", name: "Omega Assembly Co", isActive: true, phone: "+1 555 306 2006", email: "buyer@omegaassembly.com", contactPerson: "Tom Wilson", taxId: "22-3334445", billingAddress: "500 Assembly Ave", shippingAddress: "500 Assembly Ave", city: "Phoenix", country: "USA", paymentTermsDays: 60 },
  { code: "CUS-0007", name: "Alpha Distribution", isActive: true, phone: "+1 555 307 2007", email: "orders@alphadist.com", contactPerson: "Lisa Davis", taxId: "33-4445556", billingAddress: "600 Distribution Way", shippingAddress: "600 Distribution Way", city: "Denver", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0008", name: "Titan Heavy Equipment", isActive: true, phone: "+1 555 308 2008", email: "parts@titanheavy.com", contactPerson: "James Miller", taxId: "44-5556667", billingAddress: "700 Heavy Dr", shippingAddress: "700 Heavy Dr", city: "Houston", country: "USA", paymentTermsDays: 45 },
  { code: "CUS-0009", name: "Nova Tech Solutions", isActive: true, phone: "+1 555 309 2009", email: "procurement@novatech.com", contactPerson: "Emily Taylor", taxId: "66-7778889", billingAddress: "800 Innovation Blvd", shippingAddress: "800 Innovation Blvd", city: "San Jose", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0010", name: "Apex Construction Ltd", isActive: true, phone: "+1 555 310 2010", email: "materials@apexconstruction.com", contactPerson: "Robert Clark", taxId: "88-9990001", billingAddress: "900 Builders Rd", shippingAddress: "900 Builders Rd", city: "Atlanta", country: "USA", paymentTermsDays: 45 },
  { code: "CUS-0011", name: "Crown Automotive Group", isActive: true, phone: "+1 555 311 2011", email: "parts@crownauto.com", contactPerson: "Maria Garcia", taxId: "99-0001112", billingAddress: "1000 Auto Plaza", shippingAddress: "1000 Auto Plaza", city: "Miami", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0012", name: "Pinnacle Electronics", isActive: true, phone: "+1 555 312 2012", email: "purchasing@pinnacleelec.com", contactPerson: "Chris Martinez", taxId: "10-1112223", billingAddress: "1100 Circuit St", shippingAddress: "1100 Circuit St", city: "Seattle", country: "USA", paymentTermsDays: 14 },
  { code: "CUS-0013", name: "Summit Retail Chain", isActive: true, phone: "+1 555 313 2013", email: "dc@summitretail.com", contactPerson: "Karen White", taxId: "20-2122232", billingAddress: "1200 Retail Park", shippingAddress: "1200 Retail Park", city: "Minneapolis", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0014", name: "Horizon Fleet Services", isActive: true, phone: "+1 555 314 2014", email: "inventory@horizonfleet.com", contactPerson: "Paul Harris", taxId: "30-3233342", billingAddress: "1300 Fleet Ave", shippingAddress: "1300 Fleet Ave", city: "Boston", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0015", name: "Vertex Engineering", isActive: true, phone: "+1 555 315 2015", email: "orders@vertexeng.com", contactPerson: "Nancy Lewis", taxId: "40-4344452", billingAddress: "1400 Engineer Way", shippingAddress: "1400 Engineer Way", city: "Philadelphia", country: "USA", paymentTermsDays: 45 },
  { code: "CUS-0016", name: "Meridian Supply Co", isActive: true, phone: "+1 555 316 2016", email: "buyer@meridiansupply.com", contactPerson: "Steve Robinson", taxId: "50-5455562", billingAddress: "1500 Supply Ln", shippingAddress: "1500 Supply Ln", city: "Portland", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0017", name: "Atlas Wholesale", isActive: true, phone: "+1 555 317 2017", email: "atlas.orders@atlaswholesale.com", contactPerson: "Laura Walker", taxId: "60-6566672", billingAddress: "1600 Wholesale Dr", shippingAddress: "1600 Wholesale Dr", city: "San Diego", country: "USA", paymentTermsDays: 60 },
  { code: "CUS-0018", name: "Pacific Rim Trading", isActive: true, phone: "+1 555 318 2018", email: "procurement@pacrimtrading.com", contactPerson: "Kevin Hall", taxId: "70-7677782", billingAddress: "1700 Pacific Hwy", shippingAddress: "1700 Pacific Hwy", city: "Los Angeles", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0019", name: "Continental Builders", isActive: true, phone: "+1 555 319 2019", email: "materials@continentalbuilders.com", contactPerson: "Jennifer Young", taxId: "80-8788892", billingAddress: "1800 Construction Blvd", shippingAddress: "1800 Construction Blvd", city: "Las Vegas", country: "USA", paymentTermsDays: 45 },
  { code: "CUS-0020", name: "Global Parts Network", isActive: true, phone: "+1 555 320 2020", email: "orders@globalparts.com", contactPerson: "Daniel King", taxId: "90-9899902", billingAddress: "1900 Global Way", shippingAddress: "1900 Global Way", city: "New York", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0021", name: "Regional OEM Partner", isActive: true, email: "purchasing@regionaloem.com", contactPerson: "Rachel Scott", taxId: "01-1021032", billingAddress: "2000 OEM Park", shippingAddress: "2000 OEM Park", city: "Toronto", country: "Canada", paymentTermsDays: 45 },
  { code: "CUS-0022", name: "Metro Service Centers", isActive: true, phone: "+1 555 322 2022", email: "inventory@metroservice.com", contactPerson: "Mark Green", taxId: "02-2032042", billingAddress: "2100 Metro Plaza", shippingAddress: "2100 Metro Plaza", city: "Washington", country: "USA", paymentTermsDays: 14 },
  { code: "CUS-0023", name: "Former Account Inc", isActive: false, phone: "+1 555 323 2023", email: "archive@formeraccount.com", contactPerson: "Susan Adams", taxId: "03-3043052", billingAddress: "2200 Old St", city: "Chicago", country: "USA", paymentTermsDays: 30 },
  { code: "CUS-0024", name: "Inactive Customer Ltd", isActive: false, city: "Boston", country: "USA" },
  { code: "CUS-0025", name: "United Industrial Buyers", isActive: true, phone: "+1 555 325 2025", email: "orders@unitedindustrial.com", contactPerson: "Brian Wright", taxId: "05-5065072", billingAddress: "2500 United Ave", shippingAddress: "2500 United Ave", city: "Charlotte", country: "USA", paymentTermsDays: 30 },
];

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "customers",
  flush: flushPendingCustomerPersist,
  isBusy: getCustomerPersistBusy,
});
