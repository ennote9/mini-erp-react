import type { LabelTemplate } from "./model";
import { getLabelsFilePath, loadLabelsPersisted, writeLabelsPayload } from "@/shared/labelsPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";
import { normalizeLabelTemplate } from "./lib/normalizeLabelTemplate";
import { buildDefaultLabelTemplates } from "./lib/defaultLabelTemplates";

export type UpdateLabelTemplatePatch = Partial<
  Omit<LabelTemplate, "id" | "createdAt">
> & { updatedAt?: string };

const PERSIST_PATH = getLabelsFilePath("templates.json");

const store: LabelTemplate[] = [];
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

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
          console.error("[labelTemplateRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getLabelTemplatePersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingLabelTemplatePersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function touchUpdated(t: LabelTemplate): LabelTemplate {
  return { ...t, updatedAt: new Date().toISOString() };
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadLabelsPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords: () => buildDefaultLabelTemplates(),
    normalizeRecord: normalizeLabelTemplate,
    diagnosticsTag: "labelTemplateRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);

  const seeds = buildDefaultLabelTemplates();
  const have = new Set(store.map((x) => x.id));
  let mergedNewSystem = false;
  for (const s of seeds) {
    if (!have.has(s.id)) {
      store.push(s);
      have.add(s.id);
      mergedNewSystem = true;
    }
  }
  if (mergedNewSystem) {
    schedulePersist();
  }
}

export const labelTemplateRepository = {
  list(): LabelTemplate[] {
    return [...store];
  },

  getById(id: string): LabelTemplate | undefined {
    return store.find((x) => x.id === id);
  },

  save(entity: LabelTemplate): LabelTemplate {
    const i = store.findIndex((x) => x.id === entity.id);
    if (i === -1) {
      store.push(entity);
    } else {
      store[i] = entity;
    }
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateLabelTemplatePatch): LabelTemplate | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const prev = store[i];
    const next: LabelTemplate = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    store[i] = next;
    schedulePersist();
    return next;
  },

  archive(id: string): LabelTemplate | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = touchUpdated({
      ...store[i],
      isArchived: true,
      isActive: false,
    });
    schedulePersist();
    return store[i];
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "label-templates",
  flush: flushPendingLabelTemplatePersist,
  isBusy: getLabelTemplatePersistBusy,
});
