import type { Carrier, CarrierTypeId } from "./model";
import { isCarrierTypeId } from "./model";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

export type CreateCarrierInput = Omit<Carrier, "id">;
export type UpdateCarrierPatch = Partial<Omit<Carrier, "id">>;

const store: Carrier[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("carriers.json");

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceCarrierType(v: unknown): CarrierTypeId {
  if (typeof v === "string" && isCarrierTypeId(v)) return v;
  return "courier";
}

function normalizeCarrier(raw: unknown): Carrier | null {
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
  const paymentTerms = asOptionalNumber(rec.paymentTermsDays);
  return {
    id: rec.id,
    code: rec.code,
    name: rec.name,
    isActive: rec.isActive,
    carrierType: coerceCarrierType(rec.carrierType),
    contactPerson: asOptionalString(rec.contactPerson),
    phone: asOptionalString(rec.phone),
    email: asOptionalString(rec.email),
    website: asOptionalString(rec.website),
    country: asOptionalString(rec.country),
    city: asOptionalString(rec.city),
    address: asOptionalString(rec.address),
    comment: asOptionalString(rec.comment),
    trackingUrlTemplate: asOptionalString(rec.trackingUrlTemplate),
    serviceLevelDefault: asOptionalString(rec.serviceLevelDefault),
    paymentTermsDays: paymentTerms,
  };
}

function buildSeedCarriers(): Carrier[] {
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
          console.error("[carrierRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getCarrierPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingCarrierPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedCarriers,
    normalizeRecord: normalizeCarrier,
    diagnosticsTag: "carrierRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const carrierRepository = {
  list(): Carrier[] {
    return [...store];
  },

  getById(id: string): Carrier | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateCarrierInput): Carrier {
    const entity: Carrier = { ...input, id: nextIdStr() };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateCarrierPatch): Carrier | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...store[i], ...patch };
    schedulePersist();
    return store[i];
  },

  search(query: string): Carrier[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter((x) => {
      const blob = [
        x.code,
        x.name,
        x.phone,
        x.email,
        x.city,
        x.country,
        x.website,
        x.carrierType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  },
};

const seed: CreateCarrierInput[] = [
  {
    code: "CDEK",
    name: "CDEK",
    isActive: true,
    carrierType: "courier",
    website: "https://www.cdek.ru",
    country: "RU",
    city: "Moscow",
    trackingUrlTemplate: "https://www.cdek.ru/tracking?order_id={{trackingNumber}}",
    serviceLevelDefault: "Standard",
  },
  {
    code: "DPD-EU",
    name: "DPD",
    isActive: true,
    carrierType: "transport_company",
    website: "https://www.dpd.com",
    country: "DE",
    trackingUrlTemplate: "https://tracking.dpd.com/parcel/{{trackingNumber}}",
  },
  {
    code: "DHL-INT",
    name: "DHL Express",
    isActive: true,
    carrierType: "courier",
    website: "https://www.dhl.com",
    country: "DE",
  },
  {
    code: "OWN-DELIVERY",
    name: "Own delivery fleet",
    isActive: true,
    carrierType: "own_delivery",
    contactPerson: "Dispatch",
    phone: "+1 555 0100",
    comment: "Internal drivers; use for local same-day routes.",
  },
  {
    code: "POST-NATIONAL",
    name: "National postal service",
    isActive: true,
    carrierType: "postal",
    country: "USA",
  },
  {
    code: "MKT-LOGISTICS",
    name: "Marketplace fulfillment",
    isActive: true,
    carrierType: "marketplace_logistics",
    comment: "Placeholder for marketplace-managed shipping.",
    paymentTermsDays: 14,
  },
];

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "carriers",
  flush: flushPendingCarrierPersist,
  isBusy: getCarrierPersistBusy,
});
