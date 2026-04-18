import type { PrintJob, PrintJobStatus } from "./model";
import { getLabelsFilePath, loadLabelsPersisted, writeLabelsPayload } from "@/shared/labelsPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import { normalizePrintJob } from "./lib/normalizePrintJob";

const PERSIST_PATH = getLabelsFilePath("print-jobs.json");

const store: PrintJob[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

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
        await writeLabelsPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[printJobRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getPrintJobPersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingPrintJobPersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

export type CreatePrintJobInput = Omit<PrintJob, "id" | "createdAt" | "updatedAt">;

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadLabelsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: () => [],
    normalizeRecord: normalizePrintJob,
    diagnosticsTag: "printJobRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = computeNextNumericId(store);
}

export const printJobRepository = {
  list(): PrintJob[] {
    return [...store];
  },

  getById(id: string): PrintJob | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreatePrintJobInput): PrintJob {
    const ts = new Date().toISOString();
    const entity: PrintJob = {
      ...input,
      id: String(nextId++),
      createdAt: ts,
      updatedAt: ts,
    };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: Partial<Omit<PrintJob, "id" | "createdAt">>): PrintJob | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const prev = store[i];
    store[i] = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    };
    schedulePersist();
    return store[i];
  },

  updateStatus(id: string, status: PrintJobStatus): PrintJob | undefined {
    return printJobRepository.update(id, { status });
  },

  save(entity: PrintJob): PrintJob {
    const i = store.findIndex((x) => x.id === entity.id);
    if (i === -1) {
      store.push(entity);
    } else {
      store[i] = entity;
    }
    schedulePersist();
    return entity;
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "print-jobs",
  flush: flushPendingPrintJobPersist,
  isBusy: getPrintJobPersistBusy,
});
