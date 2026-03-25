import { getMasterDataFilePath, loadMasterDataPersisted, writeMasterDataPayload } from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import type { MarkdownJournalLine, MarkdownReasonCode } from "./model";
import { buildSeedMarkdownJournalLinesFromLegacyRecords } from "./workflowMigration";

type CreateMarkdownJournalLineInput = Omit<MarkdownJournalLine, "id">;

const store: MarkdownJournalLine[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;
const PERSIST_PATH = getMasterDataFilePath("markdown-journal-lines.json");

function nextIdStr(): string {
  return String(nextId++);
}

function asReason(value: unknown): MarkdownReasonCode | null {
  if (
    value === "DAMAGED_PACKAGING" ||
    value === "EXPIRED_SOON" ||
    value === "FOUND_OLD_MARKDOWN" ||
    value === "DISPLAY_WEAR" ||
    value === "NO_LONGER_SELLABLE_AS_REGULAR" ||
    value === "OTHER"
  ) {
    return value;
  }
  return null;
}

function normalizeLine(raw: unknown): MarkdownJournalLine | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  const reasonCode = asReason(x.reasonCode);
  if (
    typeof x.id !== "string" ||
    typeof x.journalId !== "string" ||
    typeof x.itemId !== "string" ||
    typeof x.markdownPrice !== "number" ||
    typeof x.quantity !== "number" ||
    typeof x.sortOrder !== "number" ||
    !reasonCode
  ) {
    return null;
  }

  return {
    id: x.id,
    journalId: x.journalId,
    sortOrder: Math.max(1, Math.floor(x.sortOrder)),
    itemId: x.itemId,
    markdownPrice: x.markdownPrice,
    quantity: Math.max(1, Math.floor(x.quantity)),
    reasonCode,
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
    buildSeedRecords: buildSeedMarkdownJournalLinesFromLegacyRecords,
    normalizeRecord: normalizeLine,
    diagnosticsTag: "markdownJournalLineRepository",
  });

  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const markdownJournalLineRepository = {
  list(): MarkdownJournalLine[] {
    return [...store];
  },
  listByJournalId(journalId: string): MarkdownJournalLine[] {
    return store
      .filter((line) => line.journalId === journalId)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  },
  replaceForJournal(journalId: string, lines: CreateMarkdownJournalLineInput[]): MarkdownJournalLine[] {
    const keep = store.filter((line) => line.journalId !== journalId);
    const next = lines.map((line) => ({ ...line, id: nextIdStr() }));
    store.splice(0, store.length, ...keep, ...next);
    schedulePersist();
    return next;
  },
};

export async function flushPendingMarkdownJournalLinePersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

export function getMarkdownJournalLinePersistBusy(): boolean {
  return persistDepth > 0;
}

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "markdown-journal-lines",
  flush: flushPendingMarkdownJournalLinePersist,
  isBusy: getMarkdownJournalLinePersistBusy,
});
