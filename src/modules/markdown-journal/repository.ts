import { getMasterDataFilePath, loadMasterDataPersisted, writeMasterDataPayload } from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { MarkdownRecord, MarkdownReasonCode, MarkdownStatus } from "./model";

type CreateMarkdownRecordInput = Omit<MarkdownRecord, "id" | "markdownCode">;
type UpdateMarkdownRecordPatch = Partial<
  Omit<MarkdownRecord, "id" | "markdownCode" | "itemId" | "quantity">
>;

const store: MarkdownRecord[] = [];
let nextId = 1;
let nextCode = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
const PERSIST_PATH = getMasterDataFilePath("markdown-records.json");

function nextIdStr(): string {
  return String(nextId++);
}

function maxMarkdownCodeNumberInStore(): number {
  let m = 0;
  for (const row of store) {
    const n = Number.parseInt(String(row.markdownCode).replace(/^MD/i, ""), 10);
    if (Number.isFinite(n)) m = Math.max(m, n);
  }
  return m;
}

/** Globally unique sequential code; never reuses a number even if rows are removed from the store. */
function allocateMarkdownCode(): string {
  const seq = Math.max(nextCode, maxMarkdownCodeNumberInStore() + 1);
  nextCode = seq + 1;
  return `MD${String(seq).padStart(8, "0")}`;
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
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

function asStatus(v: unknown): MarkdownStatus | null {
  if (v === "ACTIVE" || v === "SOLD" || v === "CANCELLED" || v === "WRITTEN_OFF" || v === "SUPERSEDED") return v;
  return null;
}

function asReason(v: unknown): MarkdownReasonCode | null {
  if (
    v === "DAMAGED_PACKAGING" ||
    v === "EXPIRED_SOON" ||
    v === "FOUND_OLD_MARKDOWN" ||
    v === "DISPLAY_WEAR" ||
    v === "NO_LONGER_SELLABLE_AS_REGULAR" ||
    v === "OTHER"
  ) return v;
  return null;
}

function normalizeRecord(raw: unknown): MarkdownRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = asStatus(r.status);
  const reasonCode = asReason(r.reasonCode);
  if (
    typeof r.id !== "string" ||
    typeof r.itemId !== "string" ||
    typeof r.markdownCode !== "string" ||
    typeof r.markdownPrice !== "number" ||
    !status ||
    !reasonCode ||
    typeof r.createdAt !== "string" ||
    typeof r.createdBy !== "string" ||
    typeof r.warehouseId !== "string"
  ) return null;
  const batchSequenceIndex =
    typeof r.batchSequenceIndex === "number" && Number.isFinite(r.batchSequenceIndex)
      ? Math.max(1, Math.floor(r.batchSequenceIndex))
      : undefined;
  const batchSequenceTotal =
    typeof r.batchSequenceTotal === "number" && Number.isFinite(r.batchSequenceTotal)
      ? Math.max(1, Math.floor(r.batchSequenceTotal))
      : undefined;
  return {
    id: r.id,
    batchId: typeof r.batchId === "string" ? r.batchId : undefined,
    batchSequenceIndex,
    batchSequenceTotal,
    itemId: r.itemId,
    markdownCode: r.markdownCode,
    markdownPrice: r.markdownPrice,
    reasonCode,
    status,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
    warehouseId: r.warehouseId,
    locationId: typeof r.locationId === "string" ? r.locationId : undefined,
    originalBarcode: typeof r.originalBarcode === "string" ? r.originalBarcode : undefined,
    comment: typeof r.comment === "string" ? r.comment : undefined,
    basePriceAtMarkdown: typeof r.basePriceAtMarkdown === "number" ? r.basePriceAtMarkdown : undefined,
    closedAt: typeof r.closedAt === "string" ? r.closedAt : undefined,
    closedBy: typeof r.closedBy === "string" ? r.closedBy : undefined,
    supersededByMarkdownId:
      typeof r.supersededByMarkdownId === "string" ? r.supersededByMarkdownId : undefined,
    supersedesMarkdownId:
      typeof r.supersedesMarkdownId === "string" ? r.supersedesMarkdownId : undefined,
    quantity: 1,
  };
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: () => [],
    normalizeRecord,
    diagnosticsTag: "markdownRepository",
  });
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
  nextCode = Math.max(
    1,
    store.reduce((acc, row) => {
      const n = Number.parseInt(String(row.markdownCode).replace(/^MD/i, ""), 10);
      return Number.isFinite(n) ? Math.max(acc, n + 1) : acc;
    }, 1),
  );
}

export const markdownRepository = {
  list(): MarkdownRecord[] {
    return [...store];
  },
  getById(id: string): MarkdownRecord | undefined {
    return store.find((x) => x.id === id);
  },
  getByCode(code: string): MarkdownRecord | undefined {
    const q = code.trim().toUpperCase();
    return store.find((x) => x.markdownCode.toUpperCase() === q);
  },
  create(input: CreateMarkdownRecordInput): MarkdownRecord {
    const entity: MarkdownRecord = {
      ...input,
      id: nextIdStr(),
      markdownCode: allocateMarkdownCode(),
      quantity: 1,
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },
  update(id: string, patch: UpdateMarkdownRecordPatch): MarkdownRecord | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const prev = store[i];
    const merged: MarkdownRecord = { ...prev, ...patch, quantity: 1, markdownCode: prev.markdownCode };
    store[i] = merged;
    schedulePersist();
    return store[i];
  },
  search(query: string): MarkdownRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter((x) => x.markdownCode.toLowerCase().includes(q));
  },
};

export async function flushPendingMarkdownPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

export function getMarkdownPersistBusy(): boolean {
  return persistDepth > 0;
}

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "markdown-records",
  flush: flushPendingMarkdownPersist,
  isBusy: getMarkdownPersistBusy,
});

