import type { CustomerAgreement, CustomerAgreementPricingType } from "./model";
import {
  getDocumentsFilePath,
  loadDocumentsPersisted,
  writeDocumentPayload,
} from "@/shared/documentPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

export type CreateCustomerAgreementInput = Omit<CustomerAgreement, "id" | "createdAt" | "updatedAt">;
export type UpdateCustomerAgreementPatch = Partial<
  Omit<CustomerAgreement, "id" | "customerId" | "createdAt" | "updatedAt">
>;

const store: CustomerAgreement[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getDocumentsFilePath("customer-agreements.json");

function asOptionalTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asPricingType(v: unknown): CustomerAgreementPricingType | null {
  return v === "discount_percent" || v === "fixed_price" || v === "price_list" ? v : null;
}

function normalizeAgreement(raw: unknown): CustomerAgreement | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const pricingType = asPricingType(rec.pricingType);
  if (
    typeof rec.id !== "string" ||
    typeof rec.customerId !== "string" ||
    typeof rec.agreementNo !== "string" ||
    typeof rec.startDate !== "string" ||
    typeof rec.isActive !== "boolean" ||
    typeof rec.currency !== "string" ||
    pricingType === null ||
    typeof rec.createdAt !== "string" ||
    typeof rec.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id: rec.id,
    customerId: rec.customerId,
    agreementNo: rec.agreementNo,
    name: asOptionalTrimmedString(rec.name),
    startDate: rec.startDate,
    endDate: asOptionalTrimmedString(rec.endDate),
    isActive: rec.isActive,
    currency: rec.currency.trim().toUpperCase(),
    pricingType,
    discountPercent: asOptionalNumber(rec.discountPercent),
    paymentTermsDays: asOptionalNumber(rec.paymentTermsDays),
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

function computeNextNumericId(records: Array<{ id: string }>): number {
  let max = 0;
  for (const rec of records) {
    const n = Number.parseInt(rec.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeDocumentPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[customerAgreementRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getCustomerAgreementPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingCustomerAgreementPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadDocumentsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: () => [] as CustomerAgreement[],
    normalizeRecord: normalizeAgreement,
    diagnosticsTag: "customerAgreementRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(loaded.records);
}

function nowIso(): string {
  return new Date().toISOString();
}

export const customerAgreementRepository = {
  list(): CustomerAgreement[] {
    return [...store];
  },

  getById(id: string): CustomerAgreement | undefined {
    return store.find((x) => x.id === id);
  },

  listByCustomer(customerId: string): CustomerAgreement[] {
    return store
      .filter((x) => x.customerId === customerId)
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
        if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
        return Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10);
      });
  },

  create(input: CreateCustomerAgreementInput): CustomerAgreement {
    const now = nowIso();
    const entity: CustomerAgreement = {
      ...input,
      id: String(nextId++),
      createdAt: now,
      updatedAt: now,
    };
    store.push(entity);
    schedulePersist();
    return { ...entity };
  },

  update(id: string, patch: UpdateCustomerAgreementPatch): CustomerAgreement | undefined {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return undefined;
    const updated: CustomerAgreement = {
      ...store[idx],
      ...patch,
      updatedAt: nowIso(),
    };
    store[idx] = updated;
    schedulePersist();
    return { ...updated };
  },

  delete(id: string): boolean {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    schedulePersist();
    return true;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "customer-agreements",
  flush: flushPendingCustomerAgreementPersist,
  isBusy: getCustomerAgreementPersistBusy,
});
