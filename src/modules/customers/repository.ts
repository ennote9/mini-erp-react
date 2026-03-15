import type { Customer } from "./model";

export type CreateCustomerInput = Omit<Customer, "id">;
export type UpdateCustomerPatch = Partial<Omit<Customer, "id">>;

const store: Customer[] = [];
let nextId = 1;

function nextIdStr(): string {
  return String(nextId++);
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
    return entity;
  },

  update(id: string, patch: UpdateCustomerPatch): Customer | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
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
  { code: "CUS-0001", name: "Beta Corp", isActive: true, phone: "+1 555 301 2001", email: "purchasing@betacorp.com" },
  { code: "CUS-0002", name: "Gamma Industries", isActive: true, phone: "+1 555 302 2002", email: "procurement@gammaind.com" },
  { code: "CUS-0003", name: "Delta Manufacturing LLC", isActive: true, phone: "+1 555 303 2003", email: "orders@deltamfg.com" },
  { code: "CUS-0004", name: "Epsilon Systems", isActive: true, phone: "+1 555 304 2004", email: "sales-contact@epsilonsys.com" },
  { code: "CUS-0005", name: "Zeta Logistics Inc", isActive: true, phone: "+1 555 305 2005", email: "supply@zetalogistics.com" },
  { code: "CUS-0006", name: "Omega Assembly Co", isActive: true, phone: "+1 555 306 2006", email: "buyer@omegaassembly.com" },
  { code: "CUS-0007", name: "Alpha Distribution", isActive: true, phone: "+1 555 307 2007", email: "orders@alphadist.com" },
  { code: "CUS-0008", name: "Titan Heavy Equipment", isActive: true, phone: "+1 555 308 2008", email: "parts@titanheavy.com" },
  { code: "CUS-0009", name: "Nova Tech Solutions", isActive: true, phone: "+1 555 309 2009", email: "procurement@novatech.com" },
  { code: "CUS-0010", name: "Apex Construction Ltd", isActive: true, phone: "+1 555 310 2010", email: "materials@apexconstruction.com" },
  { code: "CUS-0011", name: "Crown Automotive Group", isActive: true, phone: "+1 555 311 2011", email: "parts@crownauto.com" },
  { code: "CUS-0012", name: "Pinnacle Electronics", isActive: true, phone: "+1 555 312 2012", email: "purchasing@pinnacleelec.com" },
  { code: "CUS-0013", name: "Summit Retail Chain", isActive: true, phone: "+1 555 313 2013", email: "dc@summitretail.com" },
  { code: "CUS-0014", name: "Horizon Fleet Services", isActive: true, phone: "+1 555 314 2014", email: "inventory@horizonfleet.com" },
  { code: "CUS-0015", name: "Vertex Engineering", isActive: true, phone: "+1 555 315 2015", email: "orders@vertexeng.com" },
  { code: "CUS-0016", name: "Meridian Supply Co", isActive: true, phone: "+1 555 316 2016", email: "buyer@meridiansupply.com" },
  { code: "CUS-0017", name: "Atlas Wholesale", isActive: true, phone: "+1 555 317 2017", email: "atlas.orders@atlaswholesale.com" },
  { code: "CUS-0018", name: "Pacific Rim Trading", isActive: true, phone: "+1 555 318 2018", email: "procurement@pacrimtrading.com" },
  { code: "CUS-0019", name: "Continental Builders", isActive: true, phone: "+1 555 319 2019", email: "materials@continentalbuilders.com" },
  { code: "CUS-0020", name: "Global Parts Network", isActive: true, phone: "+1 555 320 2020", email: "orders@globalparts.com" },
  { code: "CUS-0021", name: "Regional OEM Partner", isActive: true, email: "purchasing@regionaloem.com" },
  { code: "CUS-0022", name: "Metro Service Centers", isActive: true, phone: "+1 555 322 2022", email: "inventory@metroservice.com" },
  { code: "CUS-0023", name: "Former Account Inc", isActive: false, phone: "+1 555 323 2023", email: "archive@formeraccount.com" },
  { code: "CUS-0024", name: "Inactive Customer Ltd", isActive: false },
  { code: "CUS-0025", name: "United Industrial Buyers", isActive: true, phone: "+1 555 325 2025", email: "orders@unitedindustrial.com" },
];
seed.forEach((s) => customerRepository.create(s));
