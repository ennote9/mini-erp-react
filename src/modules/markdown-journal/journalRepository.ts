import { getMasterDataFilePath, loadMasterDataPersisted, writeMasterDataPayload } from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { MarkdownJournal, MarkdownJournalStatus } from "./model";
import { buildSeedMarkdownJournalsFromLegacyRecords } from "./workflowMigration";

type CreateMarkdownJournalInput = Omit<MarkdownJournal, "id" | "number">;
type UpdateMarkdownJournalPatch = Partial<Omit<MarkdownJournal, "id" | "number" | "createdAt" | "createdBy">>;

const store: MarkdownJournal[] = [];
let nextId = 1;
let nextNumber = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
const PERSIST_PATH = getMasterDataFilePath("markdown-journals.json");

function nextIdStr(): string {
  return String(nextId++);
}

function asStatus(value: unknown): MarkdownJournalStatus | null {
  if (value === "draft" || value === "posted" || value === "cancelled") return value;
  return null;
}

function allocateJournalNumber(): string {
  return `MJ${String(nextNumber++).padStart(8, "0")}`;
}

function normalizeJournal(raw: unknown): MarkdownJournal | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  const status = asStatus(x.status);
  const sourceWarehouseId =
    typeof x.sourceWarehouseId === "string"
      ? x.sourceWarehouseId
      : typeof x.warehouseId === "string"
        ? x.warehouseId
        : null;
  const targetWarehouseId =
    typeof x.targetWarehouseId === "string"
      ? x.targetWarehouseId
      : typeof x.warehouseId === "string"
        ? x.warehouseId
        : null;
  if (
    typeof x.id !== "string" ||
    typeof x.number !== "string" ||
    !status ||
    typeof sourceWarehouseId !== "string" ||
    typeof targetWarehouseId !== "string" ||
    typeof x.createdAt !== "string" ||
    typeof x.createdBy !== "string"
  ) {
    return null;
  }

  return {
    id: x.id,
    number: x.number,
    status,
    sourceWarehouseId,
    targetWarehouseId,
    comment: typeof x.comment === "string" ? x.comment : undefined,
    createdAt: x.createdAt,
    createdBy: x.createdBy,
    postedAt: typeof x.postedAt === "string" ? x.postedAt : undefined,
    postedBy: typeof x.postedBy === "string" ? x.postedBy : undefined,
    cancelledAt: typeof x.cancelledAt === "string" ? x.cancelledAt : undefined,
    cancelledBy: typeof x.cancelledBy === "string" ? x.cancelledBy : undefined,
    legacySourceIds: Array.isArray(x.legacySourceIds)
      ? x.legacySourceIds.filter((v): v is string => typeof v === "string")
      : undefined,
  };
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

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: buildSeedMarkdownJournalsFromLegacyRecords,
    normalizeRecord: normalizeJournal,
    diagnosticsTag: "markdownJournalRepository",
  });

  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
  nextNumber =
    store.reduce((acc, journal) => {
      const n = Number.parseInt(journal.number.replace(/^MJ/i, ""), 10);
      return Number.isFinite(n) ? Math.max(acc, n + 1) : acc;
    }, 1);
}

export const markdownJournalRepository = {
  list(): MarkdownJournal[] {
    return [...store];
  },
  getById(id: string): MarkdownJournal | undefined {
    return store.find((x) => x.id === id);
  },
  create(input: CreateMarkdownJournalInput): MarkdownJournal {
    const entity: MarkdownJournal = {
      ...input,
      id: nextIdStr(),
      number: allocateJournalNumber(),
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },
  update(id: string, patch: UpdateMarkdownJournalPatch): MarkdownJournal | undefined {
    const index = store.findIndex((x) => x.id === id);
    if (index === -1) return undefined;
    store[index] = { ...store[index], ...patch, id: store[index].id, number: store[index].number };
    schedulePersist();
    return store[index];
  },
  search(query: string): MarkdownJournal[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter((journal) => {
      if (journal.number.toLowerCase().includes(q)) return true;
      if ((journal.comment ?? "").toLowerCase().includes(q)) return true;
      if (journal.sourceWarehouseId.toLowerCase().includes(q)) return true;
      return journal.targetWarehouseId.toLowerCase().includes(q);
    });
  },
};

export async function flushPendingMarkdownJournalPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

export function getMarkdownJournalPersistBusy(): boolean {
  return persistDepth > 0;
}

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "markdown-journals",
  flush: flushPendingMarkdownJournalPersist,
  isBusy: getMarkdownJournalPersistBusy,
});
